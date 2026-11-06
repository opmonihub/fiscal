import React, { useState } from "react";
import {
  Filters,
  SortableRegion,
  SortableItem,
  useDataApp,
  useDashboardTabs,
} from "../../data-app-public.jsx";
import { CompanyPicker } from "./CompanyPicker.jsx";
import { DocumentDialog } from "./DocumentDialog.jsx";
import { ReviewNotice } from "./ReviewNotice.jsx";
import { createViewBuilder, companyColumn, EmptyState } from "./fiscal-ui.jsx";
import { useFiscalWorkspace } from "./useFiscalWorkspace.js";
import { fiscalTabs } from "./fiscal-tabs.js";
import xmlPreviews from "./xml-previews.json";
import { buildOverview } from "./views/Overview.jsx";
import { buildCompanies } from "./views/Companies.jsx";
import { buildIssues } from "./views/Issues.jsx";
import { buildDocuments } from "./views/Documents.jsx";
import { buildPreparation } from "./views/Preparation.jsx";
import { buildImports } from "./views/Imports.jsx";
import { buildAssessment } from "./views/Assessment.jsx";
import { buildPgdas } from "./views/Pgdas.jsx";
import "./fiscal.css";

const builders = {
  dashboard: buildOverview,
  empresas: buildCompanies,
  pendencias: buildIssues,
  documentos: buildDocuments,
  preparacao: buildPreparation,
  importacoes: buildImports,
  apuracao: buildAssessment,
  pgdas: buildPgdas,
};
const files = [
  companyColumn,
  { field: "tipo", label: "Tipo" },
  { field: "emissao", label: "Emissão" },
  { field: "nome", label: "Arquivo" },
  { field: "alertas", label: "Ocorrências" },
  { field: "arquivo", label: "Caminho" },
];
const firmColumns = [
  companyColumn,
  { field: "arquivos", label: "Arquivos" },
  { field: "NFE", label: "NF-e" },
  { field: "NFCE", label: "NFC-e" },
  { field: "CTE", label: "CT-e" },
  { field: "NFSE", label: "NFS-e" },
  { field: "alertas", label: "Com alerta" },
];

export function DashboardContent() {
  const shell = useDataApp();
  const { snapshot, queries, filters, setFilter } = shell;
  const { activeTabId } = useDashboardTabs(fiscalTabs);
  const tab = builders[activeTabId] ? activeTabId : "dashboard";
  const [company, setCompany] = useState("all");
  const [opened, setOpened] = useState(null);
  const workspace = useFiscalWorkspace(shell, company);
  const view = createViewBuilder(workspace.rows);
  const enterCompany = (row) => setCompany(row.empresa);
  const actionColumn = {
    field: "acao",
    label: "Abrir",
    renderCell: (_, row) => (
      <button
        type="button"
        className="fiscal-open-xml"
        onClick={() => setOpened(row)}
        aria-label={"Ver ficha " + row.nome}
      >
        {xmlPreviews[row.arquivo] ? "Ver ficha" : "Ver registro"}
      </button>
    ),
  };
  const docColumns = [
    actionColumn,
    companyColumn,
    { field: "tipo", label: "Tipo" },
    { field: "emissao", label: "Emissão" },
    { field: "nome", label: "Documento" },
    { field: "grupo", label: "Área" },
    { field: "alertas", label: "Ocorrências" },
  ];
  const activeTab = fiscalTabs.find((item) => item.id === tab);
  const filterIds = activeTab?.filterIds || [];
  const defaultValue = (filter) =>
    activeTab?.defaultFilters?.[filter.id] ?? filter.defaultValue ?? "all";
  const hasFilters =
    company !== "all" ||
    (snapshot.filters || []).some(
      (filter) =>
        filterIds.includes(filter.id) &&
        (filters[filter.id] ?? defaultValue(filter)) !== defaultValue(filter),
    );
  function resetFilters() {
    setCompany("all");
    for (const filter of snapshot.filters || [])
      if (filterIds.includes(filter.id))
        setFilter(filter.id, defaultValue(filter));
  }
  builders[tab]({
    ...workspace,
    ...view,
    enterCompany,
    actionColumn,
    docColumns,
    firmColumns,
    files,
  });

  return (
    <div className="fiscal-dashboard central-fiscal">
      <div className="central-context">
        <div className="central-context-period">
          <span className="central-period">Outubro de 2026</span>
          <span>Base conferida em 05/11/2026</span>
        </div>
        <span className="central-evidence-state">
          <span aria-hidden="true" />
          Conciliação final pendente
        </span>
      </div>
      <Filters
        sticky
        filters={(snapshot.filters || []).filter((filter) =>
          filterIds.includes(filter.id),
        )}
        queries={queries}
        values={filters}
        onChange={setFilter}
        trailingControls={
          hasFilters ? (
            <button
              type="button"
              className="fiscal-return"
              onClick={resetFilters}
            >
              Limpar seleção
            </button>
          ) : undefined
        }
      >
        <CompanyPicker
          companies={workspace.companies}
          value={company}
          onChange={setCompany}
        />
      </Filters>
      {company !== "all" && (
        <div className="central-selection" role="status">
          <span>
            Empresa em análise: <strong>{company}</strong>
          </span>
          <button
            type="button"
            className="fiscal-return"
            onClick={() => setCompany("all")}
          >
            Todas as empresas
          </button>
        </div>
      )}
      <ReviewNotice tab={tab} company={company} snapshot={snapshot} />
      {["dashboard", "empresas", "pendencias", "documentos"].includes(tab) &&
        workspace.rows.length === 0 && (
          <EmptyState>
            Nenhum arquivo corresponde aos filtros. Altere a seleção para
            consultar outros documentos.
          </EmptyState>
        )}
      <SortableRegion
        key={tab}
        id={"central:" + tab + ":canvas"}
        variant="canvas"
        authoredRevision={2}
        columns={12}
        spacing="standard"
        rows={view.layout}
        label="Central de análise fiscal"
      >
        {view.cards.map((card) => (
          <SortableItem
            key={card.id}
            id={card.id}
            label={card.title}
            kind={card.kind}
            span={card.span}
          >
            {card.node}
          </SortableItem>
        ))}
      </SortableRegion>
      <DocumentDialog
        key={opened?.arquivo || "closed"}
        opened={opened}
        onClose={() => setOpened(null)}
      />
    </div>
  );
}
