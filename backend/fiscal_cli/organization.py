"""The single-operation planner, publisher, and verifier."""

from __future__ import annotations

import json
import os
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .documents import FiscalParseError, effective_period, parse_document, period_alerts
from .models import CopyOperation, FiscalDocument, RunResult
from .persistence import write_atomic_json
from .publisher import hash_file, publish_operation
from .registry import (
    RegistryState,
    apply_explicit_links,
    load_csv,
    load_local,
    merge_registries,
    parse_link_json,
    save_local,
    select_companies,
)
from .routing import fiscal_participants, route_document
from .sources import discover_sources


BRANCHES = (
    ("CTE", "ENTRADA"),
    ("CTE", "SAIDA"),
    ("NFCE", "ENTRADA"),
    ("NFCE", "SAIDA"),
    ("NFE", "ENTRADA"),
    ("NFE", "SAIDA"),
    ("NFSE", "PRESTADO"),
    ("NFSE", "TOMADO"),
)


class OperationalError(RuntimeError):
    pass


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _period_is_valid(value: str) -> bool:
    if len(value) != 6 or not value.isascii() or not value.isdigit():
        return False
    return 1 <= int(value[:2]) <= 12


def _confined(path: Path, root: Path) -> Path:
    resolved_root = root.resolve()
    resolved_path = path.resolve()
    try:
        resolved_path.relative_to(resolved_root)
    except ValueError as exc:
        raise ValueError(f"destino_fora_da_raiz: {path}") from exc
    return resolved_path


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    write_atomic_json(path, payload, prefix="resultado-")


def _history_payload(result: RunResult, run_id: str, created: str, state: str, finished: str = "") -> dict[str, Any]:
    return {
        "schema_version": 1,
        "execucao_id": run_id,
        "criado_em_utc": created,
        "atualizado_em_utc": _utc_now(),
        "concluido_em_utc": finished or None,
        "estado": state,
        "progresso": {
            "operacoes": len(result.operations),
            "operacoes_finalizadas": sum(operation.status not in {"planned", "same_destination_duplicate"} for operation in result.operations),
        },
        "resultado": result.to_dict(),
    }


def _add_pending(result: RunResult, kind: str, **details: Any) -> None:
    record = {"tipo": kind, **details}
    if record not in result.pending:
        result.pending.append(record)


def _register_file_inventory(
    source_paths: list[Path], result: RunResult
) -> list[FiscalDocument]:
    documents: list[FiscalDocument] = []
    for source in source_paths:
        try:
            payload = source.read_bytes()
            document = parse_document(payload, source=str(source))
        except (OSError, FiscalParseError, ValueError) as exc:
            _add_pending(result, "arquivo_sem_classificacao", arquivo=str(source), motivo=str(exc) or exc.__class__.__name__)
            continue
        documents.append(document)
        result.documents.append(document)
        result.alerts.extend(period_alerts(document))
    return documents


def _load_registry(root: Path, csv_path: Path | None, raw_links: list[str]) -> RegistryState:
    local = load_local(root / ".fiscal" / "empresas.json")
    imported = load_csv(csv_path) if csv_path is not None else RegistryState([], [], [])
    state = merge_registries(local, imported)
    links = [parse_link_json(raw) for raw in raw_links]
    if links:
        state = apply_explicit_links(state, links)
    return state


def _make_operation(
    root: Path,
    document: FiscalDocument,
    route: Any,
    period: str,
    *,
    delivery: str,
) -> CopyOperation:
    if delivery == "importacao":
        base = root / "IMPORTACAO" / route.kind / route.movement / route.company.folder / period
    else:
        company_folder = route.company.xml_folder or route.company.folder
        base = root / "XML" / company_folder / period
    destination = _confined(base / document.source.name, root)
    return CopyOperation(
        source=document.source,
        destination=destination,
        sha256=document.sha256,
        company_cnpj=route.company.cnpj,
        company_code=route.company.code,
        company_folder=route.company.folder,
        kind=route.kind,
        movement=route.movement,
        emission=document.emission,
        service_competence=document.service_competence,
        delivery=delivery,
    )


def _plan_operations(
    root: Path,
    documents: list[FiscalDocument],
    registry: RegistryState,
    selected: dict[str, Any],
    period: str,
    organize_origin: bool,
    result: RunResult,
) -> None:
    all_ids = {company.cnpj for company in registry.companies}
    if period:
        for company in selected.values():
            for kind, movement in BRANCHES:
                path = _confined(root / "IMPORTACAO" / kind / movement / company.folder / period, root)
                result.scaffold_expected.append(str(path))

    for document in documents:
        if effective_period(document) != period:
            result.exclusions.append({
                "tipo": "fora_do_periodo",
                "arquivo": str(document.source),
                "emissao": document.emission,
                "periodo_solicitado": period,
            })
            continue
        routes, issues = route_document(document, selected)
        if issues:
            for issue in issues:
                _add_pending(result, issue.get("tipo", "papel_fiscal_invalido"), arquivo=str(document.source), **{
                    key: value for key, value in issue.items() if key != "tipo"
                })
            continue
        if not routes:
            participants = fiscal_participants(document)
            identified = {role: identifier for role, identifier in participants.items() if identifier}
            if not identified:
                _add_pending(result, "participantes_nao_identificados", arquivo=str(document.source), participantes=participants)
            elif not (set(identified.values()) & all_ids):
                for role, identifier in identified.items():
                    _add_pending(
                        result,
                        "vinculo_empresa_nao_confirmado",
                        arquivo=str(document.source),
                        cnpj=identifier,
                        papel=role,
                        campos_faltantes=["codigo_dominio", "pasta_dominio"],
                    )
            else:
                result.exclusions.append({"tipo": "fora_do_recorte", "arquivo": str(document.source), "participantes": identified})
            continue
        for route in routes:
            result.operations.append(_make_operation(root, document, route, period, delivery="importacao"))
            if organize_origin:
                result.operations.append(_make_operation(root, document, route, period, delivery="origem"))


def _group_operations(result: RunResult) -> list[list[CopyOperation]]:
    groups: dict[str, list[CopyOperation]] = {}
    for operation in result.operations:
        groups.setdefault(str(operation.destination).casefold(), []).append(operation)
    publish_groups: list[list[CopyOperation]] = []
    for operations in groups.values():
        hashes = {operation.sha256 for operation in operations}
        if len(hashes) > 1:
            for operation in operations:
                operation.status = "filename_conflict"
                operation.reason = "different_sources_same_destination"
                _add_pending(result, operation.status, arquivo=str(operation.source), destino=str(operation.destination), entrega=operation.delivery)
            continue
        destination = operations[0].destination
        if destination.exists():
            if destination.is_file() and hash_file(destination) == operations[0].sha256:
                for operation in operations:
                    operation.status = "duplicate_identical"
            else:
                for operation in operations:
                    operation.status = "filename_conflict"
                    operation.reason = "destination_has_different_content"
                    _add_pending(result, operation.status, arquivo=str(operation.source), destino=str(operation.destination), entrega=operation.delivery)
            continue
        operations[0].status = "planned"
        for operation in operations[1:]:
            operation.status = "duplicate_identical"
            operation.reason = "same_bytes_same_destination"
        publish_groups.append(operations)
    return publish_groups


def _apply_scaffold(result: RunResult, root: Path) -> bool:
    success = True
    for path_text in result.scaffold_expected:
        path = Path(path_text)
        try:
            path.mkdir(parents=True, exist_ok=True)
            if not path.is_dir():
                raise OSError("o caminho de scaffold não é um diretório")
            result.scaffold_created.append(str(path))
        except OSError as exc:
            success = False
            _add_pending(result, "falha_scaffold", caminho=str(path), motivo=str(exc))
    return success


def _apply_operations(
    result: RunResult,
    groups: list[list[CopyOperation]],
    temporary_root: Path,
    save_progress: Any,
) -> bool:
    operational_failure = False
    for group in groups:
        primary = group[0]
        status, reason = publish_operation(primary, temporary_root)
        primary.status = status
        primary.reason = reason
        if status in {"copied_verified", "duplicate_identical"}:
            for alias in group[1:]:
                alias.status = "duplicate_identical"
                alias.reason = "same_bytes_same_destination"
        else:
            for alias in group[1:]:
                alias.status = status
                alias.reason = reason
        if status in {"filename_conflict", "copy_failed"}:
            operational_failure |= status == "copy_failed"
            for operation in group:
                _add_pending(
                    result,
                    operation.status,
                    arquivo=str(operation.source),
                    destino=str(operation.destination),
                    entrega=operation.delivery,
                    motivo=operation.reason,
                )
        save_progress()
    return operational_failure


def _verify(result: RunResult, applying: bool) -> bool:
    if not applying:
        result.verification = {
            "modo": "previa",
            "pastas_esperadas": len(result.scaffold_expected),
            "operacoes_previstas": sum(operation.status in {"planned", "duplicate_identical"} for operation in result.operations),
        }
        return True

    missing_directories: list[str] = []
    for directory in result.scaffold_expected:
        if not Path(directory).is_dir():
            missing_directories.append(directory)
            _add_pending(result, "conferencia_scaffold_falhou", caminho=directory)
    verified = 0
    for operation in result.operations:
        if operation.status in {"copied_verified", "duplicate_identical"}:
            try:
                valid = operation.destination.is_file() and hash_file(operation.destination) == operation.sha256
            except OSError:
                valid = False
            if valid:
                verified += 1
            else:
                operation.status = "verification_failed"
                operation.reason = "destino_ausente_ou_hash_divergente"
                _add_pending(result, operation.status, arquivo=str(operation.source), destino=str(operation.destination))
    result.verification = {
        "modo": "conferencia_final",
        "pastas_esperadas": len(result.scaffold_expected),
        "pastas_conferidas": len(result.scaffold_expected) - len(missing_directories),
        "pastas_ausentes": missing_directories,
        "operacoes_com_hash_conferido": verified,
    }
    return not missing_directories


def _totals(result: RunResult, source_count: int) -> None:
    by_status = Counter(operation.status for operation in result.operations)
    by_company: Counter[str] = Counter()
    for operation in result.operations:
        key = f"{operation.company_folder}|{operation.kind}|{operation.movement}"
        by_company[key] += 1
    result.totals = {
        "arquivos_fonte": source_count,
        "documentos_identificados": len(result.documents),
        "operacoes_destino": len(result.operations),
        **{f"status_{key}": value for key, value in sorted(by_status.items())},
    }
    result.totals_by_company_kind_movement = dict(sorted(by_company.items()))


def run_organization(args: Any) -> tuple[RunResult, int]:
    applying = not args.simular
    # The package lives in <project>/nucleo/backend/fiscal_cli; default to the project root.
    root = (args.raiz or Path(__file__).resolve().parents[3]).expanduser()
    if not root.is_absolute():
        raise ValueError("--raiz_precisa_ser_absoluta")
    root = root.resolve()
    requested_period = args.competencia or ""
    if requested_period and not _period_is_valid(requested_period):
        raise ValueError("--competencia_deve_usar_MMAAAA")

    result = RunResult("aplicar" if applying else "simulacao", root)
    result.parameters = {
        "competencia_solicitada": requested_period or None,
        "empresas": list(args.empresa or []),
        "fontes": [str(source) for source in (args.fonte or [])],
        "organizar_origem": bool(args.organizar_origem),
        "simular": not applying,
    }

    registry = _load_registry(root, args.cadastro, args.vinculo or [])
    selected, selection_issues = select_companies(registry, args.empresa)
    result.pending.extend(selection_issues)
    result.registry_changes = registry.changes
    result.parameters["empresas_selecionadas"] = [company.folder for company in selected.values()]
    result.parameters["criterio_periodo_efetivo"] = "emissao"

    source_paths, source_issues = discover_sources(root, args.fonte)
    result.pending.extend(source_issues)
    documents = _register_file_inventory(source_paths, result)
    if requested_period:
        period = requested_period
    else:
        emission_months = sorted({document.emission for document in documents})
        if len(emission_months) == 1:
            period = emission_months[0]
        elif not emission_months:
            period = ""
            _add_pending(result, "competencia_nao_informada", acao="informe --competencia MMAAAA")
        else:
            period = ""
            _add_pending(result, "meses_de_emissao_ambiguos", meses=emission_months, acao="informe --competencia MMAAAA")
    result.period = period

    if registry.conflicts and not args.empresa:
        for conflict in registry.conflicts:
            if conflict not in result.pending:
                result.pending.append(conflict)

    if period:
        _plan_operations(root, documents, registry, selected, period, args.organizar_origem, result)
    elif not selected:
        # Preserve useful participant inventory even when the period is also
        # missing, so the next user response can provide either essential fact.
        for document in documents:
            participants = {key: value for key, value in fiscal_participants(document).items() if value}
            if participants and not (set(participants.values()) & {company.cnpj for company in registry.companies}):
                for role, identifier in participants.items():
                    _add_pending(result, "vinculo_empresa_nao_confirmado", arquivo=str(document.source), cnpj=identifier, papel=role)

    groups = _group_operations(result)
    _totals(result, len(source_paths))

    if not applying:
        result.completed = not result.pending
        _verify(result, False)
        return result, 0 if result.completed else 2

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    created = _utc_now()
    state_root = root / ".fiscal"
    lock_path = state_root / "lock"
    lock_acquired = False
    history_path = state_root / "execucoes" / run_id / "resultado.json"
    result.history_path = str(history_path)
    fatal = False
    try:
        state_root.mkdir(parents=True, exist_ok=True)
        try:
            with lock_path.open("x", encoding="utf-8") as lock_file:
                lock_file.write(json.dumps({"execucao_id": run_id, "criado_em_utc": created}, ensure_ascii=False))
                lock_file.flush()
                os.fsync(lock_file.fileno())
            lock_acquired = True
        except FileExistsError as exc:
            raise OperationalError(f"trava_local_existente: {lock_path}; verifique a execução anterior antes de removê-la") from exc

        _atomic_json(history_path, _history_payload(result, run_id, created, "em_andamento"))
        if args.vinculo:
            save_local(state_root / "empresas.json", registry)

        scaffold_ok = _apply_scaffold(result, root)
        _atomic_json(history_path, _history_payload(result, run_id, created, "em_andamento"))

        def save_progress() -> None:
            _totals(result, len(source_paths))
            _atomic_json(history_path, _history_payload(result, run_id, created, "em_andamento"))

        copy_failure = _apply_operations(result, groups, state_root / "temporarios", save_progress)
        scaffold_verified = _verify(result, True)
        if not scaffold_ok or copy_failure or not scaffold_verified:
            fatal = True
        _totals(result, len(source_paths))
        result.completed = not result.pending
        _atomic_json(history_path, _history_payload(result, run_id, created, "concluido" if result.completed else "parcial", _utc_now()))
    except OperationalError:
        raise
    except (OSError, ValueError) as exc:
        fatal = True
        _add_pending(result, "falha_operacional", motivo=str(exc))
        _totals(result, len(source_paths))
        result.completed = False
        try:
            if history_path.parent.exists():
                _atomic_json(history_path, _history_payload(result, run_id, created, "falha", _utc_now()))
        except OSError:
            pass
    finally:
        if lock_acquired:
            try:
                lock_data = json.loads(lock_path.read_text(encoding="utf-8"))
                if lock_data.get("execucao_id") == run_id:
                    lock_path.unlink(missing_ok=True)
            except (OSError, json.JSONDecodeError):
                pass

    if fatal:
        return result, 1
    return result, 0 if result.completed else 2

