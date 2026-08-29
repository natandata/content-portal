import { Download, FileText } from "lucide-react";

import { ContractPreview } from "@/components/contracts/contract-preview";
import { ContractStaffActions } from "@/components/contracts/contract-staff-actions";
import { ContractUploadModal } from "@/components/contracts/contract-upload-modal";
import { ContractStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { BUCKETS } from "@/lib/paths";
import { signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { loadClientNames } from "@/server/queries";

export async function ContractsList({ clientId }: { clientId?: string } = {}) {
  await requireStaff();
  const supabase = await createClient();

  let query = supabase.from("contracts").select("*").order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);

  const [{ data: contracts }, { data: clients }] = await Promise.all([
    query,
    supabase.from("clients").select("id, company_name").eq("status", "active").order("company_name"),
  ]);

  const rows = contracts ?? [];
  const clientOptions = (clients ?? []).map((client) => ({
    id: client.id,
    companyName: client.company_name,
  }));

  const [names, originalUrls, signedUrls] = await Promise.all([
    loadClientNames(
      supabase,
      rows.map((row) => row.client_id),
    ),
    signedUrlMap(
      supabase,
      BUCKETS.contracts,
      rows.map((row) => row.original_file_path),
    ),
    signedUrlMap(
      supabase,
      BUCKETS.signedContracts,
      rows.map((row) => row.signed_file_path),
    ),
  ]);

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Envie o contrato, acompanhe a assinatura e confira o documento devolvido."
        actions={<ContractUploadModal clients={clientOptions} defaultClientId={clientId} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="Nenhum contrato enviado"
          description="Envie o primeiro contrato para que o cliente possa baixar, assinar e devolver."
          action={<ContractUploadModal clients={clientOptions} defaultClientId={clientId} />}
        />
      ) : (
        <div className="space-y-4">
          {rows.map((contract) => {
            const originalUrl = contract.original_file_path
              ? originalUrls.get(contract.original_file_path)
              : null;
            const signedUrl = contract.signed_file_path
              ? signedUrls.get(contract.signed_file_path)
              : null;

            return (
              <Card key={contract.id} padded={false}>
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink-900">
                      {contract.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {clientId ? null : (
                        <>
                          {names.get(contract.client_id) ?? "Cliente"}
                          <span className="text-ink-300"> · </span>
                        </>
                      )}
                      Enviado em {formatDate(contract.uploaded_at ?? contract.created_at)}
                    </p>
                    {contract.notes ? (
                      <p className="mt-2 text-sm text-ink-600">{contract.notes}</p>
                    ) : null}
                  </div>

                  <ContractStatusBadge status={contract.status} className="shrink-0" />
                </div>

                <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
                  {originalUrl ? (
                    <ContractPreview
                      url={originalUrl}
                      title={`${contract.title} — original`}
                      label="Ver original"
                    />
                  ) : null}

                  {originalUrl ? (
                    <a
                      href={originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-800 transition hover:bg-ink-50"
                    >
                      <Download className="size-4" aria-hidden />
                      Contrato original
                    </a>
                  ) : (
                    <span className="text-[13px] text-ink-400">PDF original indisponivel</span>
                  )}

                  {signedUrl ? (
                    <ContractPreview
                      url={signedUrl}
                      title={`${contract.title} — assinado`}
                      label="Ver assinado"
                    />
                  ) : null}

                  {signedUrl ? (
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Download className="size-4" aria-hidden />
                      Assinado pelo cliente
                    </a>
                  ) : null}
                </div>

                <div className="border-t border-line bg-ink-50/60 px-5 py-3">
                  <ContractStaffActions contractId={contract.id} status={contract.status} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
