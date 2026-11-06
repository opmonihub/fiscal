import React from "react";

import { count, companyColumn } from "../fiscal-ui.jsx";

export function buildOverview({
  section,
  metric,
  chart,
  table,
  rows,
  firms,
  issues,
  company,
  actionColumn,
}) {
  section(
    "fiscal:metrics",
    "",
    [
      metric(
        "fiscal-total",
        "Registros da conferência",
        rows.length,
        "Associações entre arquivo e empresa; uma origem pode atender mais de uma empresa.",
      ),
      metric(
        "fiscal-companies",
        "Empresas",
        firms.length,
        "Empresas com arquivos no recorte.",
      ),
      metric(
        "fiscal-month",
        "Registros de outubro",
        rows.filter((r) => r.emissao === "Outubro/2026").length,
        "Mês de emissão extraído do conteúdo fiscal.",
      ),
      metric(
        "fiscal-alert",
        "Com ocorrências",
        issues.length,
        "Registros com ao menos uma ocorrência; Canceladas ficam fora da fila.",
      ),
    ],
    "metrics",
  );
  const charts = [
    chart(
      "fiscal-types",
      "Arquivos por espécie",
      count(rows, "tipo"),
      rows,
      company === "all" ? 4 : 12,
    ),
  ];
  if (firms.length > 1)
    charts.push(
      chart(
        "fiscal-volume",
        "Volume por empresa · até 10",
        firms
          .slice(0, 10)
          .map((r) => ({ categoria: r.empresa, arquivos: r.arquivos })),
        rows,
        8,
      ),
    );
  section("fiscal:charts", "Recebimento", charts);
  section("central:issues", "Atenção no recorte", [
    table(
      "central-overview-issues",
      "Ocorrências para revisar",
      issues,
      [
        actionColumn,
        companyColumn,
        { field: "tipo", label: "Tipo" },
        { field: "emissao", label: "Emissão" },
        { field: "proximaAcao", label: "Próxima ação" },
      ],
      issues,
    ),
  ]);
}
