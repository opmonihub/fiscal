import React from "react";
import { DataComponent } from "../../../data-app-public.jsx";
import { companyColumn, ReviewedTable as DataTable } from "../fiscal-ui.jsx";
import { issueGroups } from "../central-model.js";

export function buildIssues({
  add,
  section,
  metric,
  chart,
  table,
  rows: allRows,
  issues,
  company,
  queries,
  docColumns,
  files,
}) {
  const rows = allRows.filter((row) => row.grupo !== "Canceladas");
  section(
    "central:issue-metrics",
    "",
    [
      metric(
        "central-issue-total",
        "Arquivos com ocorrências",
        issues.length,
        "Um documento pode apresentar mais de uma ocorrência.",
      ),
      metric(
        "central-issue-companies",
        "Empresas envolvidas",
        new Set(issues.map((r) => r.empresa)).size,
      ),
      metric(
        "central-issue-period",
        "Emissão em novembro",
        rows.filter((r) => r.emissao === "Novembro/2026").length,
      ),
      metric(
        "central-issue-cancel",
        "CT-e · ajuste confirmado",
        rows.filter((r) => r.papelEmpresa === "Remetente").length,
        "Entrada por orientação do usuário; tomadores originais preservados.",
      ),
    ],
    "metrics",
  );
  section("central:issue-chart", "Motivos de revisão", [
    chart(
      "central-issue-reasons",
      "Ocorrências por motivo",
      issueGroups(rows),
      rows,
      12,
      "Categorias se sobrepõem: a mesma nota pode aparecer em emissão e competência.",
    ),
  ]);
  section("fiscal:issues", "Fila de revisão", [
    table(
      "fiscal-issue-table",
      "Documentos e próxima ação",
      issues,
      [...docColumns, { field: "proximaAcao", label: "Próxima ação" }],
      issues,
    ),
  ]);
  const coverage = (queries.cobertura?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  add(
    "central-coverage",
    "Empresas sem XML de outubro",
    <DataComponent
      variant="card"
      id="central-coverage"
      queryId="cobertura"
      title="Empresas sem XML na pasta de outubro"
      kind="table"
      sourceRows={coverage}
      displayRows={coverage}
      description="Municípios dos XMLs históricos. Ausência de arquivo não comprova ausência de movimento."
    >
      <DataTable
        searchable={coverage.length > 8}
        rows={coverage}
        columns={[
          companyColumn,
          { field: "municipio", label: "Município no XML histórico" },
          { field: "situacao", label: "Cobertura" },
        ]}
        rowKey="empresa"
        label="Cobertura de recebimento"
      />
    </DataComponent>,
    "table",
  );
  const extras = (queries.excedentes?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  add(
    "central-preexisting",
    "Destino preexistente",
    <DataComponent
      variant="card"
      id="central-preexisting"
      queryId="excedentes"
      title="Arquivo preexistente: origem a revisar"
      kind="table"
      sourceRows={extras}
      displayRows={extras}
      description="Preservado no destino; não é falha de cópia da execução atual."
    >
      <DataTable
        searchable={extras.length > 8}
        rows={extras}
        columns={files}
        rowKey="arquivo"
        label="Destino preexistente sem origem no recorte inicial"
      />
    </DataComponent>,
    "table",
  );
  section("central:coverage", "Cobertura e destinos preexistentes", [
    "central-coverage",
    "central-preexisting",
  ]);
}
