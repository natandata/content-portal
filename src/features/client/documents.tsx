import { Download, FileCheck2, FileText } from "lucide-react";

import { DocumentPreview } from "@/components/documents/document-preview";
import { GovBrSignatureButton } from "@/components/documents/gov-br-signature-button";
import { SignedDocumentUpload } from "@/components/documents/signed-document-upload";
import { Badge, ContractStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { BUCKETS } from "@/lib/paths";
import { signedDownloadUrl, signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_KIND_LABEL } from "@/lib/domain";
import { formatDate, safeFileName } from "@/lib/utils";

export async function ClientDocuments() {
  const actor = await requireClientActor();
  const supabase = await createClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = contracts ?? [];

  const signedUrls = await signedUrlMap(
    supabase,
    BUCKETS.signedContracts,
    rows.map((row) => row.signed_file_path),
  );

  // Para ler na tela precisamos da URL sem "download" forcado.
  const inlineUrls = await signedUrlMap(
    supabase,
    BUCKETS.contracts,
    rows.map((row) => row.original_file_path),
  );

  const downloadUrls = await Promise.all(
    rows.map((row) =>
      signedDownloadUrl(
        supabase,
        BUCKETS.contracts,
        row.original_file_path,
        `${safeFileName(row.title)}.pdf`,
      ),
    ),
  );

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Contrato, estrategia, brandbook e o que mais seu gestor enviar."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="Nenhum documento disponivel"
          description="Assim que o seu gestor enviar algum documento, ele aparece aqui."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((contract, index) => {
            const downloadUrl = downloadUrls[index] ?? null;
            const inlineUrl = contract.original_file_path
              ? (inlineUrls.get(contract.original_file_path) ?? null)
              : null;
            const signedUrl = contract.signed_file_path
              ? (signedUrls.get(contract.signed_file_path) ?? null)
              : null;
            const alreadySent = Boolean(contract.signed_file_path);

            return (
              <Card key={contract.id}>
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-ink-900">{contract.title}</h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Recebido em {formatDate(contract.uploaded_at ?? contract.created_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{DOCUMENT_KIND_LABEL[contract.kind]}</Badge>
                    <ContractStatusBadge status={contract.status} />
                  </div>
                  {contract.notes ? (
                    <p className="mt-3 rounded-lg border border-line bg-ink-50 px-3 py-2.5 text-sm text-ink-700">
                      {contract.notes}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {inlineUrl ? (
                    <DocumentPreview
                      url={inlineUrl}
                      title={contract.title}
                      label="Pre-visualizar"
                      fullWidth
                    />
                  ) : null}

                  {downloadUrl ? (
                    <a
                      href={downloadUrl}
                      className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 text-sm font-medium text-on-ink transition hover:bg-ink-800"
                    >
                      <Download className="size-4" aria-hidden />
                      Baixar documento
                    </a>
                  ) : (
                    <p className="text-sm text-ink-500">
                      O arquivo ainda nao esta disponivel para download.
                    </p>
                  )}

                  {/* Sem assinatura pedida, o documento e so leitura. */}
                  {!contract.requires_signature ? null : contract.status === "approved" ? (
                    <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/12 dark:text-emerald-300">
                      <FileCheck2 className="size-4 shrink-0" aria-hidden />
                      Documento conferido e aprovado pelo seu gestor.
                    </p>
                  ) : (
                    <>
                      {contract.allow_gov_br_signature ? <GovBrSignatureButton /> : null}
                      <SignedDocumentUpload
                        contractId={contract.id}
                        clientId={actor.client.id}
                        alreadySent={alreadySent}
                      />
                    </>
                  )}

                  {signedUrl ? (
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring block text-center text-sm font-medium text-accent"
                    >
                      Ver o arquivo assinado que voce enviou
                    </a>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
