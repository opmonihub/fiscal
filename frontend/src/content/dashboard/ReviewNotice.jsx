import React from "react";

export function ReviewNotice({tab, snapshot}) {
  const messages = {
    preparacao: "Cópias preparadas não comprovam lançamento no Domínio. Consulte o histórico e as pendências da seleção.",
    importacoes: "Os relatórios indicam o resultado da rotina. Conferir os lançamentos individuais antes de concluir a conciliação.",
    apuracao: "Confronte receita, histórico e classificação fiscal com a declaração. Valores coincidentes não encerram a revisão fiscal.",
    pgdas: "DAS emitido não comprova pagamento. Declaração, recibo e guia devem ser conferidos separadamente."
  };
  if (!messages[tab]) return null;
  return <aside className="central-notice" aria-label="Limites da conferência"><strong>Conferência fiscal</strong><p>{messages[tab]}</p></aside>;
}
