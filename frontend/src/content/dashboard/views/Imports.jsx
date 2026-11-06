import React from "react";
import { DataComponent } from "../../../data-app-public.jsx";
import {
  n,
  companyColumn,
  CopyPathButton,
  ReviewedTable as DataTable,
  CompactMetric as MetricCard,
} from "../fiscal-ui.jsx";

export function buildImports({
  add,
  section,
  metric,
  table,
  rows,
  company,
  queries,
  filters,
}) {
  const imports = (queries.importacoes?.rows || []).filter(
    (r) =>
      (company === "all" || r.empresa === company) &&
      (!filters.tipo || filters.tipo === "all" || r.tipo === filters.tipo),
  );
  const scopedCodes = new Set(imports.map((r) => r.codigo));
  const findings = (queries.achadosImportacao?.rows || []).filter((r) =>
    scopedCodes.has(r.codigo),
  );
  const m = (id, title, value, description) =>
    add(
      id,
      title,
      <MetricCard
        id={id}
        queryId="importacoes"
        title={title}
        value={n(value)}
        description={description}
        sourceRows={imports}
        displayRows={[{ indicador: title, quantidade: value }]}
      />,
      "metric",
      3,
    );
  section(
    "central:import-metrics",
    "",
    [
      m(
        "import-covered",
        "XMLs cobertos",
        imports.reduce((s, r) => s + (r.cobertos || 0), 0),
        "Notas localizadas nos resumos desta rodada.",
      ),
      m(
        "import-selected",
        "Notas selecionadas",
        imports.reduce((s, r) => s + (r.selecionados || 0), 0),
        "Guia de gravação e advertências Sim, sem duplicar desdobramentos. Não comprova lançamento individual.",
      ),
      m(
        "import-unselected",
        "Importar: Não",
        imports.reduce((s, r) => s + (r.naoSelecionados || 0), 0),
        "Notas não selecionadas nesta rodada; conferir lançamento anterior antes de reimportar.",
      ),
      m(
        "import-uncovered",
        "Sem relatório",
        imports
          .filter((r) => r.selecionados === null)
          .reduce((s, r) => s + r.preparados, 0),
        "XMLs preparados em ramos sem relatório de importação disponível.",
      ),
    ],
    "metrics",
  );
  add(
    "import-lots",
    "Resultado por lote",
    <DataComponent
      variant="card"
      id="import-lots"
      queryId="importacoes"
      title="Importação por empresa e lote"
      kind="table"
      sourceRows={imports}
      displayRows={imports}
      description="Logs automáticos indicam sucesso por rotina. Os resumos mostram a seleção; lançamento individual ainda exige conferência."
    >
      <DataTable
        searchable={imports.length > 8}
        rows={imports}
        rowKey="id"
        label="Resultado de importação por lote"
        columns={[
          companyColumn,
          { field: "tipo", label: "Espécie" },
          { field: "movimento", label: "Movimento" },
          { field: "preparados", label: "Preparados" },
          {
            field: "selecionados",
            label: "Selecionados",
            renderCell: (v) => (v === null ? "Não confirmado" : n(v)),
          },
          {
            field: "naoSelecionados",
            label: "Importar: Não",
            renderCell: (v) => (v === null ? "Não confirmado" : n(v)),
          },
          { field: "status", label: "Resultado" },
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:import-lots", "Conciliação dos relatórios", ["import-lots"]);
  add(
    "import-findings",
    "Achados da importação",
    <DataComponent
      variant="card"
      id="import-findings"
      queryId="achadosImportacao"
      title="O que revisar no Domínio"
      kind="table"
      sourceRows={findings}
      displayRows={findings}
      description="Relatórios originais preservados. Cada achado identifica o PDF e a página. Valores da nota não representam imposto devido."
    >
      <DataTable
        searchable={findings.length > 8}
        rows={findings}
        rowKey="id"
        label="Achados da importação"
        columns={[
          companyColumn,
          { field: "prioridade", label: "Prioridade" },
          { field: "nota", label: "Nota" },
          { field: "titulo", label: "Achado" },
          { field: "detalhe", label: "Análise e próxima ação" },
          { field: "pagina", label: "Página do PDF" },
          {
            field: "arquivo",
            label: "Fonte",
            renderCell: (v, r) => <CopyPathButton path={r.arquivo} />,
          },
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:import-findings", "Revisão com evidências", [
    "import-findings",
  ]);
}
