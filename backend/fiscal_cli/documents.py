"""Fiscal XML adapters for NFe/NFCe, CTe, and NFSe documents."""

from __future__ import annotations

import hashlib
import re
from datetime import date, datetime
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

from .models import FiscalDocument


class FiscalParseError(ValueError):
    """A stable, user-facing reason why an XML cannot be classified."""


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].split(":")[-1]


def _tag(node: ET.Element) -> str:
    return local_name(node.tag).casefold()


def _children(node: ET.Element, *names: str) -> list[ET.Element]:
    wanted = {name.casefold() for name in names}
    return [child for child in node if _tag(child) in wanted]


def _first_child(node: ET.Element, *names: str) -> ET.Element | None:
    values = _children(node, *names)
    return values[0] if values else None


def _text(node: ET.Element | None, names: Iterable[str]) -> str:
    if node is None:
        return ""
    wanted = {name.casefold() for name in names}
    for item in node.iter():
        if _tag(item) in wanted:
            value = (item.text or "").strip()
            if value:
                return value
    return ""


def _all_texts(node: ET.Element, names: Iterable[str]) -> list[str]:
    wanted = {name.casefold() for name in names}
    return [
        (item.text or "").strip()
        for item in node.iter()
        if _tag(item) in wanted and (item.text or "").strip()
    ]


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def _participant(node: ET.Element | None) -> str:
    if node is None:
        return ""
    values = {
        _digits(value)
        for value in _all_texts(node, ("CNPJ", "CPF", "CnpjCpf", "CpfCnpj"))
        if _digits(value)
    }
    if len(values) > 1:
        raise FiscalParseError("participante_fiscal_ambiguo")
    return next(iter(values), "")


def _party_by_role(node: ET.Element, *roles: str) -> str:
    return _participant(_first_child(node, *roles))


def _valid_emission(value: str) -> str:
    value = value.strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:[T ].*)?", value):
            emitted = date.fromisoformat(value[:10])
        elif re.fullmatch(r"\d{8}", value):
            emitted = datetime.strptime(value, "%Y%m%d").date()
        elif re.fullmatch(r"\d{2}/\d{2}/\d{4}", value):
            emitted = datetime.strptime(value, "%d/%m/%Y").date()
        else:
            raise ValueError
    except ValueError as exc:
        raise FiscalParseError("data_fiscal_invalida") from exc
    return emitted.strftime("%m%Y")


def _service_month(value: str) -> str:
    value = value.strip()
    patterns = (
        (r"(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?", lambda m: (m.group(1), m.group(2), m.group(3))),
        (r"(\d{4})-(\d{2})", lambda m: (m.group(1), m.group(2), "")),
        (r"(0[1-9]|1[0-2])/(\d{4})", lambda m: (m.group(2), m.group(1), "")),
        (r"(0[1-9]|1[0-2])(\d{4})", lambda m: (m.group(2), m.group(1), "")),
        (r"(\d{4})(0[1-9]|1[0-2])", lambda m: (m.group(1), m.group(2), "")),
    )
    for pattern, unpack in patterns:
        match = re.fullmatch(pattern, value)
        if match:
            year, month, day = unpack(match)
            if day:
                date(int(year), int(month), int(day))
            return f"{month}{year}"
    raise ValueError("competencia_servico_invalida")


def _competence(root: ET.Element) -> tuple[str, tuple[str, ...]]:
    values = _all_texts(root, ("dCompet", "DCompet", "Competencia", "DataCompetencia", "DCompetencia"))
    if not values:
        return "", ("competencia_servico_ausente",)
    parsed: set[str] = set()
    invalid = False
    for value in values:
        try:
            parsed.add(_service_month(value))
        except ValueError:
            invalid = True
    if len(parsed) > 1:
        return "", ("competencias_servico_conflitantes",)
    if invalid:
        return next(iter(parsed), ""), ("competencia_servico_invalida",)
    return next(iter(parsed), ""), ()


def _main_documents(root: ET.Element, names: Iterable[str]) -> list[ET.Element]:
    wanted = {name.casefold() for name in names}
    return [node for node in root.iter() if _tag(node) in wanted]


def _nfse_participants(primary: ET.Element) -> tuple[str, str]:
    bodies = _main_documents(primary, ("infDPS", "InfDeclaracaoPrestacaoServico"))
    if len(bodies) > 1:
        raise FiscalParseError("multiplos_documentos_fiscais_principais")
    containers = [primary, *(node for node in bodies if node is not primary)]
    providers = {
        _party_by_role(node, role)
        for node in containers
        for role in ("PrestadorServico", "Prestador", "prest", "emit")
    } - {""}
    takers = {
        _party_by_role(node, role)
        for node in containers
        for role in ("TomadorServico", "Tomador", "toma", "dest")
    } - {""}
    if len(providers) > 1 or len(takers) > 1:
        raise FiscalParseError("participantes_nfse_conflitantes")
    return next(iter(providers), ""), next(iter(takers), "")


def _find_primary(root: ET.Element) -> tuple[str, ET.Element]:
    parents = {child: node for node in root.iter() for child in node}

    def is_inside_cte(node: ET.Element) -> bool:
        ancestor = parents.get(node)
        while ancestor is not None:
            if _tag(ancestor) == "infcte":
                return True
            ancestor = parents.get(ancestor)
        return False

    nfe_nodes = _main_documents(root, ("infNFe",))
    # CT-e documents commonly include infNFe references inside infDoc. Those
    # are supporting references, not a second primary NF-e document.
    nfe_nodes = [node for node in nfe_nodes if not is_inside_cte(node)]
    cte_nodes = _main_documents(root, ("infCte",))
    nfse_nodes: list[ET.Element] = []
    for family in (("InfNfse", "infNFSe"), ("InfDPS", "infDPS"), ("InfDeclaracaoPrestacaoServico",)):
        nfse_nodes = _main_documents(root, family)
        if nfse_nodes:
            break
    family_count = sum(bool(nodes) for nodes in (nfe_nodes, cte_nodes, nfse_nodes))
    if family_count > 1:
        raise FiscalParseError("estrutura_fiscal_ambigua")
    for kind, nodes in (("NFE", nfe_nodes), ("CTE", cte_nodes), ("NFSE", nfse_nodes)):
        if len(nodes) > 1:
            raise FiscalParseError("multiplos_documentos_fiscais_principais")
        if nodes:
            return kind, nodes[0]

    # NFSe exports commonly use one of these document roots. Prefer the most
    # specific family present so a wrapper and its nested payload are not
    # counted twice.
    for family in (("InfNfse", "infNFSe"), ("InfDPS", "infDPS"), ("InfDeclaracaoPrestacaoServico",)):
        nfse_nodes = _main_documents(root, family)
        if nfse_nodes:
            if len(nfse_nodes) > 1:
                raise FiscalParseError("multiplos_documentos_fiscais_principais")
            return "NFSE", nfse_nodes[0]

    tags = {_tag(node) for node in root.iter()}
    if "nfse" in tags or "dps" in tags or "infdps" in tags:
        raise FiscalParseError("estrutura_nfse_nao_suportada")
    raise FiscalParseError("tipo_xml_nao_reconhecido")


def parse_document(data: bytes, *, source: str = "<memoria>") -> FiscalDocument:
    digest = hashlib.sha256(data).hexdigest()
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise FiscalParseError("xml_invalido") from exc
    family, primary = _find_primary(root)

    emission_value = _text(primary, ("dhEmi", "dEmi", "DataEmissao", "dataEmissao", "DataEmi"))
    if not emission_value:
        raise FiscalParseError("data_de_emissao_ausente")
    emission = _valid_emission(emission_value)
    service = ""
    warnings: tuple[str, ...] = ()

    if family in {"NFE", "CTE"}:
        model = _text(primary, ("mod",))
        expected = {"NFE": {"55", "65"}, "CTE": {"57", "67"}}[family]
        if model not in expected:
            raise FiscalParseError("modelo_fiscal_ausente_ou_incompativel")
        if family == "NFE":
            operation = _text(primary, ("tpNF",))
            if operation not in {"0", "1"}:
                raise FiscalParseError("tipo_operacao_nfe_invalido")
            kind = "NFCE" if model == "65" else "NFE"
            return FiscalDocument(
                source=Path(source),
                sha256=digest,
                kind=kind,
                emission=emission,
                issuer=_party_by_role(primary, "emit"),
                recipient=_party_by_role(primary, "dest"),
                operation_type=operation,
            )

        ide = _first_child(primary, "ide")
        issuer = _party_by_role(primary, "emit")
        toma4 = _first_child(ide, "toma4") if ide is not None else None
        if toma4 is not None:
            taker = _participant(toma4)
        else:
            toma3 = _first_child(ide, "toma3") if ide is not None else None
            code = _text(toma3, ("toma",))
            role = {"0": "rem", "1": "exped", "2": "receb", "3": "dest"}.get(code)
            taker = _party_by_role(primary, role) if role else ""
        return FiscalDocument(
            source=Path(source),
            sha256=digest,
            kind="CTE",
            emission=emission,
            issuer=issuer,
            recipient=_party_by_role(primary, "dest"),
            taker=taker,
        )

    service, warnings = _competence(primary)
    if service and service != emission:
        warnings = (*warnings, "competencia_servico_divergente")
    provider, taker = _nfse_participants(primary)
    if not provider and not taker:
        raise FiscalParseError("participantes_nfse_nao_identificados")
    return FiscalDocument(
        source=Path(source),
        sha256=digest,
        kind="NFSE",
        emission=emission,
        service_competence=service,
        issuer=provider,
        recipient=taker,
        taker=taker,
        warnings=warnings,
    )


def effective_period(document: FiscalDocument) -> str:
    """Return the only supported placement period: valid fiscal emission."""
    return document.emission


def period_alerts(document: FiscalDocument) -> list[dict[str, str]]:
    """Expand service-period metadata into actionable, non-blocking alerts."""
    alerts: list[dict[str, str]] = []
    for warning in document.warnings:
        if warning == "competencia_servico_divergente":
            alerts.append({
                "tipo": warning,
                "emissao": document.emission,
                "competencia_servico": document.service_competence,
                "arquivo": str(document.source),
            })
        elif warning in {"competencia_servico_ausente", "competencia_servico_invalida", "competencias_servico_conflitantes"}:
            alerts.append({"tipo": warning, "emissao": document.emission, "arquivo": str(document.source)})
    return alerts

