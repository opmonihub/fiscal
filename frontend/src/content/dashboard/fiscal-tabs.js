export const fiscalTabs = [
  {
    id: "dashboard",
    label: "Visão geral",
    filterIds: ["grupo", "tipo", "emissao", "situacao"],
  },
  {
    id: "empresas",
    label: "Empresas",
    filterIds: ["grupo", "tipo", "emissao", "situacao"],
  },
  {
    id: "pendencias",
    label: "Pendências",
    filterIds: ["grupo", "tipo", "emissao", "situacao"],
    defaultFilters: { grupo: "all" },
  },
  {
    id: "documentos",
    label: "Documentos",
    filterIds: ["grupo", "tipo", "emissao", "situacao"],
  },
  {
    id: "preparacao",
    label: "Preparação Domínio",
    filterIds: ["tipo", "emissao"],
  },
  { id: "importacoes", label: "Importações", filterIds: ["tipo"] },
  { id: "apuracao", label: "Apuração", filterIds: [] },
  { id: "pgdas", label: "PGDAS / DAS", filterIds: [] },
];
