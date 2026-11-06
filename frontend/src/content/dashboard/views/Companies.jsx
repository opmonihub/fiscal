import React from "react";

import { count } from "../fiscal-ui.jsx";

export function buildCompanies({
  section,
  metric,
  table,
  rows,
  firms,
  company,
  enterCompany,
  docColumns,
  firmColumns,
  files,
}) {
  section(
    "central:company-metrics",
    "",
    [
      metric("central-company-count", "Empresas no recorte", firms.length),
      metric("central-company-files", "Arquivos", rows.length),
      metric(
        "central-company-alerts",
        "Empresas com ocorrências",
        firms.filter((r) => r.alertas > 0).length,
      ),
      metric(
        "central-company-oct",
        "Registros de outubro",
        rows.filter((r) => r.emissao === "Outubro/2026").length,
      ),
    ],
    "metrics",
  );
  section("fiscal:companies", "Mapa das empresas", [
    table(
      "fiscal-company-table",
      "Documentos e ocorrências por empresa",
      firms,
      firmColumns,
      rows,
      {
        rowKey: "empresa",
        onSelect: enterCompany,
        description:
          "Selecione uma empresa para restringir a central aos seus documentos. Código e pasta de destino conferidos com o cadastro disponível.",
      },
    ),
  ]);
  section("central:company-files", "Documentos da seleção", [
    table("central-company-docs", "Registros por empresa", rows, docColumns),
  ]);
}
