import React, { useMemo, useState } from "react";
import { Dialog, Button, DataTable } from "../../data-app-public.jsx";
import xmlPreviews from "./xml-previews.json";
import { readXmlDetails } from "./xml-details.js";

function FieldList({ entries }) {
  return (
    <dl className="fiscal-fields">
      {entries.map((e, i) => (
        <div key={e.label + i}>
          <dt>{e.label}</dt>
          <dd>{e.value}</dd>
        </div>
      ))}
    </dl>
  );
}
function XmlBranch({ branch }) {
  if (!branch) return null;
  return branch.children.length ? (
    <details className="fiscal-xml-branch">
      <summary>{branch.label}</summary>
      {branch.children.map((b, i) => (
        <XmlBranch key={b.label + i} branch={b} />
      ))}
    </details>
  ) : (
    <div className="fiscal-xml-leaf">
      <span>{branch.label}</span>
      <span>{branch.value || "—"}</span>
    </div>
  );
}

export function DocumentDialog({ opened, onClose }) {
  const [copied, setCopied] = useState(false);
  const preview = opened ? xmlPreviews[opened.arquivo] : null;
  const xmlText = useMemo(() => {
    if (!preview?.base64) return "";
    const bytes = Uint8Array.from(atob(preview.base64), (c) => c.charCodeAt(0));
    const head = new TextDecoder().decode(bytes.slice(0, 180));
    const encoding = head.match(/encoding=["']([^"']+)["']/i)?.[1] || "utf-8";
    try {
      return new TextDecoder(encoding).decode(bytes);
    } catch {
      return new TextDecoder().decode(bytes);
    }
  }, [preview]);
  const details = useMemo(() => readXmlDetails(xmlText), [xmlText]);
  function downloadXml() {
    if (!preview?.base64) return;
    const bytes = Uint8Array.from(atob(preview.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/xml" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = opened.nome;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Dialog
      open={Boolean(opened)}
      onClose={onClose}
      title="Ficha do documento"
      expanded
    >
      {opened && (
        <div className="fiscal-xml-viewer">
          <p>
            <strong>{opened.empresa}</strong> · {opened.tipo} · {opened.emissao}
          </p>
          <p>{opened.alertas}</p>
          <p className="fiscal-xml-path">
            {preview?.path || opened.arquivo}
          </p>
          <div className="fiscal-xml-actions">
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    preview?.path ||
                      opened.arquivo,
                  );
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Caminho copiado" : "Copiar caminho original"}
            </Button>
            <Button onClick={downloadXml} disabled={!preview?.base64}>
              Baixar XML
            </Button>
          </div>
          <p className="fiscal-xml-note">
            Cópia verificada com o conteúdo da conferência de 05/11/2026. O
            arquivo original permanece preservado.
          </p>
          {details && !details.error ? (
            <div className="fiscal-document" data-reviewed-rows>
              <section className="fiscal-doc-section">
                <h3>Identificação da nota</h3>
                <FieldList entries={details.info} />
              </section>
              <div className="fiscal-parties">
                {details.parties.map((p) => (
                  <section className="fiscal-doc-section" key={p.title}>
                    <h3>{p.title}</h3>
                    <FieldList entries={p.entries} />
                  </section>
                ))}
              </div>
              {details.values.length > 0 && (
                <section className="fiscal-doc-section">
                  <h3>Valores informados</h3>
                  <FieldList entries={details.values} />
                </section>
              )}
              {details.service && (
                <section className="fiscal-doc-section">
                  <h3>
                    {opened.tipo === "NFSE"
                      ? "Descrição do serviço"
                      : "Informações complementares"}
                  </h3>
                  <p className="fiscal-service">{details.service}</p>
                </section>
              )}
              {details.items.length > 0 && (
                <section className="fiscal-doc-section">
                  <h3>Produtos · {details.items.length} itens</h3>
                  <DataTable
                    label="Produtos da nota"
                    rows={details.items}
                    columns={[
                      { field: "numero", label: "Item" },
                      { field: "descricao", label: "Descrição" },
                      { field: "quantidade", label: "Quantidade" },
                      { field: "unidade", label: "Unidade" },
                      { field: "unitario", label: "Valor unitário" },
                      { field: "total", label: "Total" },
                    ]}
                  />
                </section>
              )}
              <details className="fiscal-doc-section">
                <summary>Todos os campos do documento</summary>
                <XmlBranch branch={details.tree} />
              </details>
            </div>
          ) : (
            <section className="fiscal-doc-section">
              <h3>Registro da conferência</h3>
              <FieldList
                entries={[
                  { label: "Tipo", value: opened.tipo },
                  { label: "Emissão", value: opened.emissao },
                  { label: "Área", value: opened.grupo },
                  { label: "SHA-256", value: opened.hash },
                ]}
              />
              <p className="fiscal-xml-note">
                A ficha com o conteúdo completo está disponível para os
                documentos com ocorrências. Use o caminho original para acessar
                este XML.
              </p>
            </section>
          )}
          {preview?.base64 && (
            <details className="fiscal-doc-section">
              <summary>Ver código XML original</summary>
              <pre
                className="fiscal-xml-code"
                tabIndex={0}
                aria-label="Conteúdo XML"
                data-reviewed-rows
              >
                {xmlText.replace(/>\s*</g, ">\n<")}
              </pre>
            </details>
          )}
        </div>
      )}
    </Dialog>
  );
}
