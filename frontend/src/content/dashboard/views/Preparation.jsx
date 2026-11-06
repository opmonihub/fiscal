import React from "react";
import { DataComponent } from "../../../data-app-public.jsx";
import { companyColumn, ReviewedTable as DataTable } from "../fiscal-ui.jsx";

export function buildPreparation({
  add,
  section,
  metric,
  table,
  rows,
  october,
  prepared,
  octFirms,
  scopeStructures,
  company,
  enterCompany,
}) {
  section(
    "central:prep-metrics",
    "",
    [
      metric(
        "central-prep-source",
        "Registros de outubro",
        october.length,
        "Inclui recebimentos manuais; exclui copy e canceladas. Contagem por associação com empresa.",
        october,
      ),
      metric(
        "central-prep-matched",
        "Com cópia correspondente",
        prepared.length,
        "Mesma empresa e SHA-256 na origem e em IMPORTACAO.",
        october,
      ),
      metric(
        "central-prep-unmatched",
        "Sem cópia correspondente",
        october.length - prepared.length,
        "Ainda não foi encontrada cópia idêntica no destino; não implica documento pronto.",
        october,
      ),
      metric(
        "central-prep-dest",
        "Empresas preparadas",
        new Set(prepared.map((r) => r.empresa)).size,
        "Empresas com documentos preparados e conferidos.",
        prepared,
      ),
    ],
    "metrics",
  );
  section("central:prep-states", "Preparação por empresa", [
    table(
      "central-prep-company",
      "Cópias correspondentes de outubro",
      octFirms,
      [
        companyColumn,
        { field: "outubro", label: "Origem outubro" },
        { field: "preparados", label: "Cópias idênticas" },
        { field: "situacao", label: "Correspondência" },
      ],
      october,
      { rowKey: "empresa", onSelect: enterCompany },
    ),
  ]);
  const structureRows = scopeStructures.map((r) => ({
    ...r,
    estrutura: r.pastas + " / " + r.esperadas,
  }));
  add(
    "central-prep-structure",
    "Estrutura de destino",
    <DataComponent
      variant="card"
      id="central-prep-structure"
      queryId="estrutura"
      title="Pastas físicas por empresa"
      kind="table"
      sourceRows={scopeStructures}
      displayRows={structureRows}
      description="Oito ramos definidos pelo núcleo fiscal. Este quadro considera a empresa; espécie e emissão não alteram a exigência dos oito ramos."
    >
      <DataTable
        searchable={structureRows.length > 8}
        rows={structureRows}
        columns={[
          companyColumn,
          { field: "estrutura", label: "Pastas existentes / esperadas" },
        ]}
        rowKey="empresa"
        label="Pastas físicas por empresa"
      />
    </DataComponent>,
    "table",
  );
  section("central:prep-structure", "Estrutura de importação", [
    "central-prep-structure",
  ]);
}
