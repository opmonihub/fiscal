"""Versioned company registry with optional CSV import and explicit updates."""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath
from typing import Any, Iterable

from .persistence import write_atomic_json


REGISTRY_SCHEMA_VERSION = 1


@dataclass(frozen=True)
class Company:
    code: str
    folder: str
    cnpj: str
    active: bool = True
    xml_folder: str = ""

    def to_dict(self) -> dict[str, object]:
        return {
            "codigo_dominio": self.code,
            "pasta_dominio": self.folder,
            "cnpj": self.cnpj,
            "ativo": self.active,
            "pasta_xml": self.xml_folder or None,
        }


@dataclass
class RegistryState:
    companies: list[Company]
    conflicts: list[dict[str, Any]]
    changes: list[dict[str, Any]]

    def payload(self) -> dict[str, Any]:
        return {
            "schema_version": REGISTRY_SCHEMA_VERSION,
            "empresas": [company.to_dict() for company in self.companies],
        }


def digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def safe_folder(value: str) -> bool:
    return bool(
        value
        and value not in {".", ".."}
        and not value.endswith((" ", "."))
        and not re.search(r'[<>:"|?*/\\]', value)
        and not PureWindowsPath(value).drive
        and not PureWindowsPath(value).is_absolute()
    )


def make_company(record: dict[str, object]) -> Company:
    code = str(record.get("codigo_dominio", ""))
    folder = str(record.get("pasta_dominio", ""))
    cnpj = digits(str(record.get("cnpj", "")))
    active_value = record.get("ativo", True)
    active = active_value if isinstance(active_value, bool) else str(active_value).strip().casefold() in {"1", "sim", "true", "yes"}
    xml_folder = str(record.get("pasta_xml") or "")
    if not re.fullmatch(r"\d+", code):
        raise ValueError("codigo_dominio_invalido")
    if len(cnpj) not in {11, 14}:
        raise ValueError("identificador_fiscal_invalido")
    if not safe_folder(folder) or not folder.startswith(f"{code}-") or not folder[len(code) + 1 :].strip():
        raise ValueError("pasta_dominio_invalida_ou_codigo_divergente")
    if xml_folder and not safe_folder(xml_folder):
        raise ValueError("pasta_xml_insegura")
    return Company(code, folder, cnpj, active, xml_folder)


def company_signature(company: Company) -> tuple[str, str, str, bool, str]:
    return (company.code, company.folder, company.cnpj, company.active, company.xml_folder)


def reconcile(companies: Iterable[Company], changes: list[dict[str, Any]] | None = None) -> RegistryState:
    unique: list[Company] = []
    seen: set[tuple[str, str, str, bool, str]] = set()
    for company in companies:
        signature = company_signature(company)
        if signature not in seen:
            unique.append(company)
            seen.add(signature)

    conflicts: list[dict[str, Any]] = []
    for field_name, label in (("cnpj", "cnpj"), ("code", "codigo_dominio"), ("folder", "pasta_dominio")):
        buckets: dict[str, list[Company]] = {}
        for company in unique:
            buckets.setdefault(getattr(company, field_name), []).append(company)
        for key, records in buckets.items():
            if len({company_signature(record) for record in records}) > 1:
                conflicts.append({
                    "tipo": "cadastro_em_conflito",
                    "campo": label,
                    "valor": key,
                    "correspondencias": [record.to_dict() for record in records],
                })
    return RegistryState(unique, conflicts, list(changes or []))


def load_local(path: Path) -> RegistryState:
    if not path.exists():
        return RegistryState([], [], [])
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict) or payload.get("schema_version") != REGISTRY_SCHEMA_VERSION:
        raise ValueError("versao_de_cadastro_nao_suportada")
    raw_companies = payload.get("empresas")
    if not isinstance(raw_companies, list):
        raise ValueError("cadastro_empresas_invalido")
    companies: list[Company] = []
    for entry in raw_companies:
        if not isinstance(entry, dict):
            raise ValueError("registro_de_empresa_invalido")
        companies.append(make_company(entry))
    return reconcile(companies)


def load_csv(path: Path) -> RegistryState:
    if not path.is_absolute():
        raise ValueError("--cadastro_precisa_ser_absoluto")
    companies: list[Company] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        required = {"codigo_dominio", "pasta_dominio", "cnpj", "ativo"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("cadastro_deve_conter_codigo_dominio;pasta_dominio;cnpj;ativo")
        for line, row in enumerate(reader, start=2):
            try:
                companies.append(make_company(row))
            except ValueError as exc:
                raise ValueError(f"linha_{line}:{exc}") from exc
    return reconcile(companies)


def merge_registries(*states: RegistryState) -> RegistryState:
    return reconcile(
        (company for state in states for company in state.companies),
        [change for state in states for change in state.changes],
    )


def apply_explicit_links(state: RegistryState, records: Iterable[dict[str, object]]) -> RegistryState:
    companies = list(state.companies)
    changes = list(state.changes)
    for raw in records:
        company = make_company(raw)
        matched = [item for item in companies if item.cnpj == company.cnpj or item.code == company.code]
        if matched and all(company_signature(item) == company_signature(company) for item in matched):
            continue
        if matched:
            changes.append({
                "tipo": "vinculo_confirmado_ou_corrigido",
                "cnpj": company.cnpj,
                "codigo_dominio": company.code,
                "anteriores": [item.to_dict() for item in matched],
                "novo": company.to_dict(),
            })
            companies = [item for item in companies if item not in matched]
        else:
            changes.append({"tipo": "vinculo_confirmado", "cnpj": company.cnpj, "novo": company.to_dict()})
        companies.append(company)
    return reconcile(companies, changes)


def parse_link_json(value: str) -> dict[str, object]:
    try:
        record = json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError("--vinculo_deve_ser_objeto_json_valido") from exc
    if not isinstance(record, dict):
        raise ValueError("--vinculo_deve_ser_objeto_json")
    company = make_company(record)
    return company.to_dict()


def select_companies(state: RegistryState, selectors: list[str] | None) -> tuple[dict[str, Company], list[dict[str, Any]]]:
    available = [company for company in state.companies if company.active]
    conflicted_cnps = {
        record.get("cnpj")
        for issue in state.conflicts
        for record in issue.get("correspondencias", [])
    }
    conflicted_codes = {
        record.get("codigo_dominio")
        for issue in state.conflicts
        for record in issue.get("correspondencias", [])
    }
    available = [company for company in available if company.cnpj not in conflicted_cnps and company.code not in conflicted_codes]
    if not selectors:
        return {company.cnpj: company for company in available}, list(state.conflicts)

    selected: dict[str, Company] = {}
    pending: list[dict[str, Any]] = []
    for selector in selectors:
        key = digits(selector)
        matches = [company for company in available if company.cnpj == key or company.code == key]
        if len(matches) != 1:
            conflict = next((item for item in state.conflicts if item.get("valor") == key), None)
            pending.append(conflict or {"tipo": "empresa_nao_encontrada_ou_ambigua", "selecao": selector})
            continue
        selected[matches[0].cnpj] = matches[0]
    return selected, pending


def save_local(path: Path, state: RegistryState) -> None:
    """Atomically persist the validated local registry."""
    write_atomic_json(path, state.payload(), prefix="empresas-")

