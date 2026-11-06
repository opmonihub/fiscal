import React from "react";

import { count } from "../fiscal-ui.jsx";

export function buildDocuments({
  section,
  metric,
  table,
  rows,
  principal,
  docColumns,
  files,
}) {
  section(
    "central:doc-metrics",
    "",
    [
      metric("central-doc-count", "Arquivos no recorte", rows.length),
      metric("central-doc-primary", "Da origem principal", principal.length),
      metric(
        "central-doc-copy",
        "Recebidos manuais",
        rows.filter((r) => r.origemManual).length,
        "Incluídos na organização conferida.",
      ),
      metric(
        "central-doc-import",
        "Preparados",
        rows.filter((r) => r.preparado).length,
        "Registros com destino e hash conferidos; não confirma lançamento.",
      ),
    ],
    "metrics",
  );
  section("fiscal:files", "Consulta de documentos", [
    table("fiscal-file-table", "Inventário de arquivos", rows, docColumns),
  ]);
}
