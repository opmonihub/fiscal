import React from "react";
import { DataComponent } from "../../../data-app-public.jsx";
import {
  n,
  CompanyIdentity,
  companyColumn,
  CopyPathButton,
  EmptyState,
  ReviewedTable as DataTable,
  money,
  moneyColumn,
  CompactMetric as MetricCard,
} from "../fiscal-ui.jsx";

function GuideStatus({ row, received }) {
  const matches = row.diferenca != null && Number(row.diferenca) === 0;
  const label = !received
    ? "Falta declaração / recibo"
    : row.diferenca == null
      ? "Sem par comparável"
      : matches
        ? "Valores conferem"
        : "Revisar diferença";
  return (
    <span className="central-guide-status">
      <span
        title={row.status}
        className={
          "central-status central-status-" +
          (received && matches ? "matched" : "review")
        }
      >
        {label}
      </span>
    </span>
  );
}

export function buildPgdas({ add, section, company, queries, enterCompany }) {
  const reports = (queries.pgdas?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  const taxes = (queries.pgdasTributos?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  const findings = (queries.pgdasAchados?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  const sum = (field) => {
    const known = reports.filter((r) => r[field] != null);
    return known.length
      ? money(known.reduce((total, r) => total + Number(r[field]), 0))
      : "—";
  };
  const metric = (id, title, value, description) =>
    add(
      id,
      title,
      <MetricCard
        id={id}
        queryId="pgdas"
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
    "central:pgdas-metrics",
    "",
    [
      metric(
        "pgdas-count",
        "DAS recebidos",
        n(reports.length),
        "Empresa, CNPJ e competência conferidos nos PDFs.",
      ),
      metric(
        "pgdas-local",
        "Domínio disponível",
        sum("apuradoDominio"),
        `${reports.filter((r) => r.apuradoDominio != null).length} de ${reports.length} empresas da seleção têm demonstrativo do Domínio disponível. Valor ausente não é zero.`,
      ),
      metric(
        "pgdas-receita",
        "DAS da Receita",
        sum("dasReceita"),
        "Valor da guia emitida, sem confirmação de pagamento.",
      ),
      metric(
        "pgdas-difference",
        "Diferença dos comparáveis",
        sum("diferenca"),
        "Receita menos Domínio somente nos pares completos. Consultar as divergências e as evidências disponíveis.",
      ),
    ],
    "metrics",
  );
  const declarationRows = (queries.pgdasDeclaracoes?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  const declaredCodes = new Set(declarationRows.map((r) => r.codigo));
  add(
    "pgdas-comparison",
    "Conciliação dos DAS",
    <DataComponent
      variant="card"
      id="pgdas-comparison"
      queryId="pgdas"
      queryIds={["pgdas", "pgdasDeclaracoes"]}
      title="Domínio × DAS da Receita"
      kind="table"
      sourceRowsByQuery={{ pgdas: reports, pgdasDeclaracoes: declarationRows }}
      displayRows={reports}
      description="Competência 10/2026. Diferença = DAS da Receita menos Domínio. Valores coincidentes não encerram a revisão fiscal. Selecione uma empresa para consultar seus documentos e achados."
    >
      {reports.length ? (
        <DataTable
          searchable={false}
          rows={reports}
          rowKey="codigo"
          label="Conciliação do DAS"
          onRowSelect={enterCompany}
          rowActionLabel={(r) => "Analisar " + r.empresa}
          columns={[
            companyColumn,
            moneyColumn("apuradoDominio", "Domínio"),
            moneyColumn("dasReceita", "DAS Receita"),
            moneyColumn("diferenca", "Diferença"),
            {
              field: "status",
              label: "Conferência",
              renderCell: (_, r) => (
                <GuideStatus row={r} received={declaredCodes.has(r.codigo)} />
              ),
            },
            {
              field: "arquivo",
              label: "Fonte",
              renderCell: (v, r) => <CopyPathButton path={r.arquivo} />,
            },
          ]}
        />
      ) : (
        <EmptyState>Nenhum DAS recebido para esta empresa.</EmptyState>
      )}
    </DataComponent>,
    "table",
  );
  section("central:pgdas-comparison", "Guias emitidas", ["pgdas-comparison"]);
  const declarations = (queries.pgdasDeclaracoes?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  const history = (queries.pgdasHistorico?.rows || []).filter(
    (r) => company === "all" || r.empresa === company,
  );
  add(
    "pgdas-declarations",
    "Declarações e recibos",
    <DataComponent
      variant="card"
      id="pgdas-declarations"
      queryId="pgdasDeclaracoes"
      title="Retificadoras e recibos recebidos"
      kind="table"
      sourceRows={declarations}
      displayRows={declarations}
      description="Declaração nas páginas 1 a 3 e recibo na página 4 dos PDFs. Transmissão comprovada não certifica enquadramento tributário nem pagamento."
    >
      <DataTable
        searchable={declarations.length > 8}
        rows={declarations}
        emptyMessage="Declaração e recibo ainda não recebidos para esta seleção. O DAS disponível é apresentado acima."
        rowKey="codigo"
        label="Declarações e recibos"
        columns={[
          companyColumn,
          { field: "tipo", label: "Declaração" },
          moneyColumn("receita", "Receita declarada"),
          moneyColumn("rbt12", "RBT12 declarada"),
          moneyColumn("debito", "Débito declarado"),
          { field: "transmissao", label: "Transmissão · Brasília" },
          {
            field: "recibo",
            label: "Recibo",
            renderCell: (value) => <span title={value}>Recebido</span>,
          },
        ]}
      />
    </DataComponent>,
    "table",
  );
  add(
    "pgdas-history",
    "Diferenças do histórico",
    <DataComponent
      variant="card"
      id="pgdas-history"
      queryId="pgdasHistorico"
      title="Diferenças do histórico de receita"
      kind="table"
      sourceRows={history}
      displayRows={history}
      description="Comparar o histórico do Domínio com o declarado. Diferenças devem ser investigadas nas fontes antes de corrigir qualquer valor."
    >
      <DataTable
        searchable={history.length > 8}
        rows={history}
        emptyMessage="Nenhuma diferença histórica documentada para esta seleção."
        rowKey="periodo"
        label="Divergência do histórico de receita"
        columns={[
          companyColumn,
          { field: "periodo", label: "Mês do histórico" },
          moneyColumn("dominio", "Domínio"),
          moneyColumn("pgdas", "PGDAS"),
          moneyColumn("diferenca", "PGDAS menos Domínio"),
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:pgdas-declarations", "Transmissão e histórico", [
    "pgdas-declarations",
    "pgdas-history",
  ]);
  add(
    "pgdas-taxes",
    "Diferença por tributo",
    <DataComponent
      variant="card"
      id="pgdas-taxes"
      queryId="pgdasTributos"
      title="Composição por tributo"
      kind="table"
      sourceRows={taxes}
      displayRows={taxes}
      description="Os tributos de atividades distintas são agrupados por imposto para comparar com a guia única."
    >
      <DataTable
        searchable={taxes.length > 8}
        rows={taxes}
        emptyMessage="Nenhum detalhamento por tributo disponível para esta seleção."
        rowKey="id"
        label="Diferença por tributo"
        columns={[
          companyColumn,
          { field: "tributo", label: "Tributo" },
          moneyColumn("dominio", "Domínio"),
          moneyColumn("receita", "DAS Receita"),
          moneyColumn("diferenca", "Diferença"),
        ]}
      />
    </DataComponent>,
    "table",
  );
  section("central:pgdas-taxes", "Localização das diferenças", ["pgdas-taxes"]);
  add(
    "pgdas-findings",
    "Revisão da transmissão",
    <DataComponent
      variant="card"
      id="pgdas-findings"
      queryId="pgdasAchados"
      title="O que falta esclarecer"
      kind="table"
      sourceRows={findings}
      displayRows={findings}
    >
      {findings.length ? (
        <div className="central-review-list" data-reviewed-rows>
          {findings.map((r) => (
            <details className="central-review-item" key={r.id}>
              <summary className="central-review-summary">
                <CompanyIdentity value={r.empresa} />
                <span className="central-review-title">{r.titulo}</span>
                <span className="central-source-page">Pág. {r.pagina}</span>
              </summary>
              <div className="central-review-detail">
                <p>{r.detalhe}</p>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <EmptyState>Nenhum achado registrado para esta seleção.</EmptyState>
      )}
    </DataComponent>,
    "table",
  );
  section("central:pgdas-findings", "Pendências da conciliação", [
    "pgdas-findings",
  ]);
}
