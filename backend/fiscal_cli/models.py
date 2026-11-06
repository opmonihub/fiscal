"""Versioned data contracts shared by the fiscal CLI and its adapters."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class FiscalDocument:
    source: Path
    sha256: str
    kind: str = ""
    emission: str = ""
    service_competence: str = ""
    issuer: str = ""
    recipient: str = ""
    operation_type: str = ""
    taker: str = ""
    status: str = "identified"
    reason: str = ""
    warnings: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["source"] = str(self.source)
        result["warnings"] = list(self.warnings)
        return result


@dataclass
class CopyOperation:
    source: Path
    destination: Path
    sha256: str
    company_cnpj: str
    company_code: str
    company_folder: str
    kind: str
    movement: str
    emission: str
    service_competence: str = ""
    delivery: str = "importacao"
    status: str = "planned"
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["source"] = str(self.source)
        result["destination"] = str(self.destination)
        return result


@dataclass
class RunResult:
    mode: str
    root: Path
    period: str = ""
    completed: bool = False
    documents: list[FiscalDocument] = field(default_factory=list)
    operations: list[CopyOperation] = field(default_factory=list)
    alerts: list[dict[str, Any]] = field(default_factory=list)
    pending: list[dict[str, Any]] = field(default_factory=list)
    exclusions: list[dict[str, Any]] = field(default_factory=list)
    scaffold_expected: list[str] = field(default_factory=list)
    scaffold_created: list[str] = field(default_factory=list)
    totals: dict[str, int] = field(default_factory=dict)
    totals_by_company_kind_movement: dict[str, int] = field(default_factory=dict)
    verification: dict[str, Any] = field(default_factory=dict)
    registry_changes: list[dict[str, Any]] = field(default_factory=list)
    history_path: str | None = None
    parameters: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "modo": self.mode,
            "concluido": self.completed,
            "raiz": str(self.root),
            "competencia": self.period,
            "parametros": self.parameters,
            "documentos": [document.to_dict() for document in self.documents],
            "operacoes": [operation.to_dict() for operation in self.operations],
            "totais": self.totals,
            "totais_por_empresa_especie_movimento": self.totals_by_company_kind_movement,
            "scaffold_esperado": self.scaffold_expected,
            "scaffold_criado": self.scaffold_created,
            "alertas": self.alerts,
            "pendencias": self.pending,
            "exclusoes": self.exclusions,
            "conferencia": self.verification,
            "alteracoes_cadastro": self.registry_changes,
            "historico": self.history_path,
        }

