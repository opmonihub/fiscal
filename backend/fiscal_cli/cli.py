"""Command line interface for the single fiscal organization operation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .organization import OperationalError, run_organization


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="fiscal", description="Organiza XMLs fiscais em uma operação local.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    organize = subparsers.add_parser("organizar", help="descobre, classifica, copia e confere XMLs")
    organize.add_argument("--fonte", type=Path, action="append", help="pasta ou XML absoluto; pode repetir")
    organize.add_argument("--competencia", help="período MMYYYY; omitido, só infere se houver um único mês de emissão")
    organize.add_argument("--empresa", action="append", help="código Domínio ou identificador fiscal confirmado; pode repetir")
    organize.add_argument("--vinculo", action="append", default=[], help="objeto JSON com codigo_dominio, pasta_dominio e cnpj; pode repetir")
    organize.add_argument("--cadastro", type=Path, help="CSV UTF-8 separado por ponto e vírgula (opcional)")
    organize.add_argument("--organizar-origem", action="store_true", help="prepara também cópias em XML/EMPRESA/MMYYYY")
    organize.add_argument("--simular", action="store_true", help="mostra o plano sem persistir ou copiar arquivos")
    organize.add_argument("--json", action="store_true", help="emite o contrato estruturado no stdout")
    organize.add_argument("--raiz", type=Path, help="raiz absoluta do projeto; por padrão usa a raiz do pacote")
    return parser


def _human_report(payload: dict[str, Any]) -> str:
    lines = [
        f"Modo: {payload['modo']}",
        f"Resultado: {'integral' if payload['concluido'] else 'parcial'}",
        f"Período de emissão: {payload.get('competencia') or 'não definido'}",
    ]
    if payload.get("raiz"):
        lines.append(f"Destino: {Path(payload['raiz']) / 'IMPORTACAO'}")
    if "totais" in payload:
        totals = payload["totais"]
        lines.append(f"Arquivos fonte: {totals.get('arquivos_fonte', 0)}; documentos identificados: {totals.get('documentos_identificados', 0)}; operações: {totals.get('operacoes_destino', 0)}")
    if "scaffold_esperado" in payload:
        lines.append(f"Scaffold: {len(payload['scaffold_esperado'])} diretórios esperados; {len(payload.get('scaffold_criado', []))} conferidos/criados nesta execução")
    if payload.get("totais_por_empresa_especie_movimento"):
        lines.append("Totais por empresa/espécie/movimento:")
        lines.extend(f"  {key}: {value}" for key, value in payload["totais_por_empresa_especie_movimento"].items())
    if payload.get("alertas"):
        lines.append("Alertas:")
        lines.extend(f"  {item.get('tipo')}: {item.get('arquivo')}" for item in payload["alertas"])
    if payload.get("pendencias"):
        lines.append("Pendências:")
        lines.extend(f"  {item.get('tipo')}: {item.get('arquivo') or item.get('caminho') or item.get('acao') or item.get('motivo') or item}" for item in payload["pendencias"])
    if payload.get("historico"):
        lines.append(f"Histórico: {payload['historico']}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result, exit_code = run_organization(args)
        payload = result.to_dict()
    except (ValueError, OSError, OperationalError) as exc:
        operational = isinstance(exc, (OSError, OperationalError))
        payload = {
            "schema_version": 1,
            "modo": "simulacao" if args.simular else "aplicar",
            "concluido": False,
            "pendencias": [{"tipo": "falha_operacional" if operational else "dados_invalidos", "motivo": str(exc)}],
        }
        exit_code = 1 if operational else 2
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(_human_report(payload))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

