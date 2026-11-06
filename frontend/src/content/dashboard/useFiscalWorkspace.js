import { useMemo } from "react";
import { companySummary, nextAction } from "./central-model.js";

export function useFiscalWorkspace(
  { queries, filters, reviewedRows },
  company,
) {
  const base = reviewedRows("arquivos", [
    "empresa",
    "tipo",
    "grupo",
    "emissao",
    "situacao",
  ]);
  const rows =
    company === "all" ? base : base.filter((row) => row.empresa === company);
  const structures = queries.estrutura?.rows || [];
  const companies = useMemo(
    () =>
      [
        ...new Set((queries.arquivos?.rows || []).map((row) => row.empresa)),
      ].sort(),
    [queries.arquivos],
  );
  const firms = companySummary(rows, structures);
  const issues = rows
    .filter((row) => row.temAlerta && row.grupo !== "Canceladas")
    .map((row) => ({ ...row, proximaAcao: nextAction(row) }));
  const principal = rows.filter((row) => row.grupo === "Origem principal");
  const october = principal.filter((row) => row.emissao === "Outubro/2026");
  const prepared = october.filter((row) => row.preparado);
  const octFirms = companySummary(october, structures);
  const scopeStructures = structures.filter(
    (row) => company === "all" || row.empresa === company,
  );
  return {
    rows,
    firms,
    issues,
    principal,
    october,
    prepared,
    octFirms,
    scopeStructures,
    companies,
    queries,
    filters,
    company,
  };
}
