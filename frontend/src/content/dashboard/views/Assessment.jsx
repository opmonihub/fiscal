import React from "react";
import { DataComponent } from "../../../data-app-public.jsx";
import {
  n,
  companyColumn,
  ReviewedTable as DataTable,
  money,
  moneyColumn,
  CompactMetric as MetricCard,
} from "../fiscal-ui.jsx";

export function buildAssessment({
  add,
  section,
  metric,
  table,
  rows,
  company,
  queries,
}) {
  const reports = (queries.apuracao?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  const activities = (queries.apuracaoSegmentos?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  const predictions = (queries.apuracaoProjecoes?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  const findings = reports.length
    ? (queries.apuracaoAchados?.rows || []).filter(
        (r) =>
          company === "all" || r.codigo === "ambas" || r.empresa === company,
      )
    : [];
  const m = (id, title, value, description) =>
    add(
      id,
      title,
      <MetricCard
        id={id}
        queryId="apuracao"
        title={title}
        value={value}
        description={description}
        sourceRows={reports}
        displayRows={[{ indicador: title, valor: value }]}
      />,
      "metric",
      3,
    );
  section(
    "central:assessment-metrics",
    "",
    [
      m(
        "assessment-companies",
        "Empresas apuradas",
        n(reports.length),
        "Empresas com demonstrativo disponível para outubro/2026.",
      ),
      m(
        "assessment-revenue",
        "Receita apurada",
        reports.length
          ? money(reports.reduce((s, r) => s + Number(r.receita), 0))
          : "—",
        "Receita conferida com documentos; não equivale ao total bruto de todos os XMLs de saída.",
      ),
      m(
        "assessment-tax",
        "Simples no Domínio",
        reports.length
          ? money(reports.reduce((s, r) => s + Number(r.simples), 0))
          : "—",
        "Valor do demonstrativo, sujeito à revisão da classificação fiscal; não é confirmação de DAS.",
      ),
      m(
        "assessment-review",
        "Com revisão fiscal",
        n(reports.length),
        "Histórico e classificação fiscal ainda exigem revisão, mesmo quando o DAS confere.",
      ),
    ],
    "metrics",
  );
  add(
    "assessment-summary",
    "Resumo da apuração",
    <DataComponent
      variant="card"
      id="assessment-summary"
      queryId="apuracao"
      title="Apuração por empresa · outubro/2026"
      kind="table"
      sourceRows={reports}
      displayRows={reports}
    >
      <DataTable
        searchable={reports.length > 8}
        rows={reports}
        rowKey="codigo"
        label="Resumo da apuração"
        columns={[
          companyColumn,
          moneyColumn("receita", "Receita"),
          moneyColumn("rbt12", "RBT12"),
          moneyColumn("simples", "Simples apurado"),
          { field: "status", label: "Conferência" },
          { field: "pgdas", label: "PGDAS" },
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:assessment-summary", "Apuração recebida", [
    "assessment-summary",
  ]);
  const cross = (queries.apuracaoPgdas?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  add(
    "assessment-pgdas",
    "Cruzamento com PGDAS",
    <DataComponent
      variant="card"
      id="assessment-pgdas"
      queryId="apuracaoPgdas"
      title="Domínio × declaração PGDAS"
      kind="table"
      sourceRows={cross}
      displayRows={cross}
      description="Valores em reais. Diferença = PGDAS menos Domínio. Soma interna correta não comprova igualdade com o declarado; conferir a cobertura das fontes."
    >
      <DataTable
        searchable={cross.length > 8}
        rows={cross}
        rowKey="id"
        label="Cruzamento de bases e débito"
        columns={[
          companyColumn,
          { field: "indicador", label: "Indicador" },
          moneyColumn("dominio", "Domínio"),
          moneyColumn("pgdas", "PGDAS"),
          moneyColumn("diferenca", "Diferença"),
          { field: "situacao", label: "Conferência" },
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:assessment-pgdas", "Conciliação com a declaração", [
    "assessment-pgdas",
  ]);
  add(
    "assessment-activities",
    "Conciliação de receitas",
    <DataComponent
      variant="card"
      id="assessment-activities"
      queryId="apuracaoSegmentos"
      title="XMLs e receita por atividade"
      kind="table"
      sourceRows={activities}
      displayRows={activities}
      description="Devoluções e exclusões por natureza devem ser conciliadas com os documentos. Alíquotas são as aplicadas à atividade após a segregação do Domínio."
    >
      <DataTable
        searchable={activities.length > 8}
        rows={activities}
        rowKey="id"
        label="Conciliação da receita com XMLs"
        columns={[
          companyColumn,
          { field: "anexo", label: "Atividade" },
          moneyColumn("receitaXml", "XMLs"),
          moneyColumn("exclusao", "Exclusão por natureza"),
          moneyColumn("receitaApurada", "Receita apurada"),
          moneyColumn("diferenca", "Diferença"),
          {
            field: "aliquota",
            label: "Alíquota aplicada",
            renderCell: (v) =>
              Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 6 }) +
              "%",
          },
          moneyColumn("simples", "Simples"),
          { field: "tratamento", label: "Tratamento no Domínio" },
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:assessment-activities", "Conferência com os documentos", [
    "assessment-activities",
  ]);
  add(
    "assessment-findings",
    "Revisões da apuração",
    <DataComponent
      variant="card"
      id="assessment-findings"
      queryId="apuracaoAchados"
      title="O que revisar antes do fechamento"
      kind="table"
      sourceRows={findings}
      displayRows={findings}
    >
      <DataTable
        searchable={findings.length > 8}
        rows={findings}
        rowKey="id"
        label="Pontos de revisão da apuração"
        columns={[
          companyColumn,
          { field: "prioridade", label: "Prioridade" },
          { field: "titulo", label: "Ponto de atenção" },
          { field: "detalhe", label: "Análise" },
          { field: "fonte", label: "Evidência" },
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:assessment-findings", "Revisão fiscal", [
    "assessment-findings",
  ]);
  add(
    "assessment-next-period",
    "Projeção do período seguinte",
    <DataComponent
      variant="card"
      id="assessment-next-period"
      queryId="apuracaoProjecoes"
      title="Novembro/2026 · projeção"
      kind="table"
      sourceRows={predictions}
      displayRows={predictions}
      description="Os arquivos com 102026 no nome informam competência 11/2026. Alíquotas brutas da fórmula, antes da segregação de tributos; não comparar diretamente com as alíquotas líquidas aplicadas em outubro."
    >
      <DataTable
        searchable={predictions.length > 8}
        rows={predictions}
        rowKey="codigo"
        label="Projeção de novembro"
        columns={[
          companyColumn,
          { field: "competencia", label: "Competência" },
          moneyColumn("rbt12", "RBT12 projetada"),
          {
            field: "aliquotaBrutaComercio",
            label: "Alíquota bruta · comércio",
            renderCell: (v) =>
              v == null
                ? "Não aplicável"
                : Number(v).toLocaleString("pt-BR", {
                    maximumFractionDigits: 6,
                  }) + "%",
          },
          {
            field: "aliquotaBrutaServicos",
            label: "Alíquota bruta · serviços",
            renderCell: (v) =>
              v == null
                ? "Não aplicável"
                : Number(v).toLocaleString("pt-BR", {
                    maximumFractionDigits: 6,
                  }) + "%",
          },
          { field: "status", label: "Situação" },
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:assessment-next-period", "Período seguinte", [
    "assessment-next-period",
  ]);
}
