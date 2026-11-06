"""Determine per-company movement for a classified fiscal document."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from .models import FiscalDocument
from .registry import Company


@dataclass(frozen=True)
class Route:
    company: Company
    kind: str
    movement: str


def fiscal_participants(document: FiscalDocument) -> dict[str, str]:
    if document.kind in {"NFE", "NFCE"}:
        return {"emitente": document.issuer, "destinatario": document.recipient}
    if document.kind == "CTE":
        return {
            "emitente": document.issuer,
            "destinatario": document.recipient,
            "tomador": document.taker,
        }
    if document.kind == "NFSE":
        return {"prestador": document.issuer, "tomador": document.taker}
    return {}


def route_document(
    document: FiscalDocument,
    selected: Mapping[str, Company],
) -> tuple[list[Route], list[dict[str, str]]]:
    """Return selected participant destinations and role conflicts.

    A known company outside ``selected`` never blocks destinations for the
    selected participants. Unknown parties are left for the caller to report
    as inventory or registry follow-up.
    """
    roles: list[tuple[str, str]]
    if document.kind in {"NFE", "NFCE"}:
        if document.operation_type not in {"0", "1"}:
            return [], [{"tipo": "tipo_operacao_nfe_invalido"}]
        issuer_movement, recipient_movement = (("SAIDA", "ENTRADA") if document.operation_type == "1" else ("ENTRADA", "SAIDA"))
        roles = [(document.issuer, issuer_movement), (document.recipient, recipient_movement)]
    elif document.kind == "CTE":
        # O CT-e emitido pela própria empresa representa sua prestação.
        # A repetição de seu CNPJ em destinatário/tomador não cria uma segunda
        # operação de entrada para o mesmo estabelecimento.
        roles = [
            (document.issuer, "SAIDA"),
            *[(identifier, "ENTRADA") for identifier in (document.recipient, document.taker)
              if identifier != document.issuer],
        ]
    elif document.kind == "NFSE":
        roles = [(document.issuer, "PRESTADO"), (document.taker, "TOMADO")]
    else:
        return [], [{"tipo": "tipo_xml_nao_reconhecido"}]

    roles = list(dict.fromkeys(roles))
    by_company: dict[str, set[str]] = {}
    for cnpj, movement in roles:
        if cnpj in selected:
            by_company.setdefault(cnpj, set()).add(movement)
    conflicts = [
        {"tipo": "papeis_fiscais_incompativeis", "cnpj": cnpj, "movimentos": ",".join(sorted(movements))}
        for cnpj, movements in by_company.items()
        if len(movements) > 1
    ]
    conflicting_ids = {issue["cnpj"] for issue in conflicts}
    routes = [
        Route(selected[cnpj], document.kind, movement)
        for cnpj, movement in roles
        if cnpj in selected and cnpj not in conflicting_ids
    ]
    return routes, conflicts

