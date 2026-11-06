"""Discover XML inputs without broad filesystem searches."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable


def discover_sources(root: Path, explicit: Iterable[Path] | None = None) -> tuple[list[Path], list[dict[str, str]]]:
    """Return unique XML files and actionable source issues.

    With no explicit paths, only ``<root>/XML`` is inspected. Explicit paths
    replace that default and can point to XML files or mixed-content folders.
    Overlapping inputs are deduplicated by their resolved path.
    """
    chosen = list(explicit or [])
    issues: list[dict[str, str]] = []
    if not chosen:
        default = root / "XML"
        if not default.is_dir():
            return [], [{"tipo": "origem_xml_padrao_ausente", "caminho_esperado": str(default), "acao": "indique --fonte com uma pasta ou XML"}]
        chosen = [default]

    unique: dict[str, Path] = {}
    for source in chosen:
        if not source.is_absolute():
            issues.append({"tipo": "fonte_precisa_ser_absoluta", "fonte": str(source)})
            continue
        if not source.exists():
            issues.append({"tipo": "fonte_nao_encontrada", "fonte": str(source), "acao": "confirme o caminho ou indique outra pasta"})
            continue
        if source.is_file():
            if source.suffix.casefold() != ".xml":
                issues.append({"tipo": "fonte_arquivo_nao_xml", "fonte": str(source)})
                continue
            candidates = [source]
        elif source.is_dir():
            try:
                candidates = list(source.rglob("*"))
            except OSError as exc:
                issues.append({"tipo": "falha_ao_listar_fonte", "fonte": str(source), "detalhe": str(exc)})
                continue
        else:
            issues.append({"tipo": "fonte_tipo_nao_suportado", "fonte": str(source)})
            continue
        found_in_source = 0
        for candidate in candidates:
            if candidate.name.casefold() == "desktop.ini":
                continue
            if candidate.is_file() and candidate.suffix.casefold() == ".xml":
                try:
                    resolved = candidate.resolve(strict=True)
                except OSError as exc:
                    issues.append({"tipo": "fonte_inacessivel", "fonte": str(candidate), "detalhe": str(exc)})
                    continue
                unique.setdefault(str(resolved).casefold(), resolved)
                found_in_source += 1
        if source.is_dir() and not found_in_source:
            issues.append({"tipo": "fonte_sem_xml", "fonte": str(source)})
    return sorted(unique.values(), key=lambda item: str(item).casefold()), issues

