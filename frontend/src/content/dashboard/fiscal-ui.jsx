import React, { useState } from "react";
import {
  DataComponent,
  DataTable,
  EvidenceChart,
  SectionHeader,
} from "../../data-app-public.jsx";

export const n = (value) => Number(value).toLocaleString("pt-BR");
export const money = (value) =>
  value == null
    ? "—"
    : Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

export function CompanyIdentity({ value }) {
  const match = String(value).match(/^(\d+)-(.*)$/);
  return (
    <span className="central-company-identity">
      <span>{match ? match[2] : value}</span>
      {match && <small title={"Código " + match[1]}>{match[1]}</small>}
    </span>
  );
}

export const companyColumn = {
  field: "empresa",
  label: "Empresa",
  renderCell: (value) => <CompanyIdentity value={value} />,
};
export const moneyColumn = (field, label) => ({
  field,
  label,
  renderCell: (value) => (
    <span
      className={
        "central-number" +
        (field === "diferenca" && value != null && Number(value) !== 0
          ? " central-number-difference"
          : "")
      }
    >
      {money(value)}
    </span>
  ),
});

export function CopyPathButton({ path }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(path);
      setStatus("Caminho copiado");
    } catch {
      setStatus("Não foi possível copiar. Tente novamente.");
    }
  }
  return (
    <span className="central-copy-action">
      <button type="button" className="fiscal-open-xml" onClick={copy}>
        Caminho do PDF
      </button>
      {status && <small role="status">{status}</small>}
    </span>
  );
}

export function EmptyState({
  children = "Nenhum registro disponível para esta seleção.",
}) {
  return (
    <p className="central-empty" role="status">
      {children}
    </p>
  );
}

export function ReviewedTable({ rows = [], emptyMessage, ...props }) {
  return rows.length ? (
    <DataTable rows={rows} {...props} />
  ) : (
    <EmptyState>{emptyMessage}</EmptyState>
  );
}

export function CompactMetric({
  id,
  queryId,
  title,
  value,
  description,
  sourceRows,
  displayRows,
}) {
  return (
    <div className="central-compact-metric">
      <DataComponent
        variant="plain"
        id={id}
        queryId={queryId}
        title={title}
        kind="metric"
        description={description}
        sourceRows={sourceRows}
        displayRows={displayRows}
      >
        <div className="central-metric-value" data-reviewed-rows>
          {value}
        </div>
      </DataComponent>
    </div>
  );
}

export function createViewBuilder(defaultRows) {
  const cards = [];
  const layout = [];
  function add(id, title, node, kind = "chart", span = 12) {
    cards.push({ id, title, node, kind, span });
    return id;
  }
  function section(id, title, items, kind) {
    layout.push({
      id,
      kind,
      items,
      spacing: kind === "metrics" ? "none" : "content",
      header:
        title && items.length > 1 ? (
          <SectionHeader id={id + "-title"} title={title} />
        ) : undefined,
    });
  }
  function metric(id, title, value, description, source = defaultRows) {
    return add(
      id,
      title,
      <CompactMetric
        id={id}
        queryId="arquivos"
        title={title}
        value={n(value)}
        description={description}
        sourceRows={source}
        displayRows={[{ indicador: title, arquivos: value }]}
      />,
      "metric",
      3,
    );
  }
  function chart(id, title, data, source = defaultRows, span = 6, description) {
    return add(
      id,
      title,
      <EvidenceChart
        variant="card"
        id={id}
        queryId="arquivos"
        title={title}
        description={description}
        rows={data}
        sourceRows={source}
        spec={{
          type: "horizontalBar",
          x: "categoria",
          y: "arquivos",
          valueDecimals: 0,
          showValues: true,
          stackable: false,
        }}
        height={Math.max(180, Math.min(340, data.length * 34 + 55))}
      />,
      "chart",
      span,
    );
  }
  function table(id, title, data, columns, source = defaultRows, extra = {}) {
    return add(
      id,
      title,
      <DataComponent
        variant="card"
        id={id}
        queryId="arquivos"
        title={title}
        kind="table"
        displayRows={data}
        sourceRows={source}
        description={extra.description}
      >
        {data.length ? (
          <DataTable
            rows={data}
            columns={columns}
            rowKey={extra.rowKey || "registro"}
            label={title}
            searchable={data.length > 8}
            onRowSelect={extra.onSelect}
            rowActionLabel={
              extra.onSelect ? (row) => "Analisar " + row.empresa : undefined
            }
          />
        ) : (
          <EmptyState />
        )}
      </DataComponent>,
      "table",
      12,
    );
  }
  return { cards, layout, add, section, metric, chart, table };
}

export function count(rows, field) {
  const groups = new Map();
  for (const row of rows)
    groups.set(row[field], (groups.get(row[field]) || 0) + 1);
  return [...groups]
    .map(([categoria, arquivos]) => ({ categoria, arquivos }))
    .sort((a, b) => b.arquivos - a.arquivos);
}
