import { Banknote, Copy, Link2, QrCode } from "lucide-react";

import { InvoiceCard } from "@/components/invoices/invoice-card";
import { InvoiceCreateModal } from "@/components/invoices/invoice-create-modal";
import { InvoiceStaffActions } from "@/components/invoices/invoice-staff-actions";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { BUCKETS } from "@/lib/paths";
import { signedDownloadUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { formatDate, safeFileName } from "@/lib/utils";
import { loadClientNames, loadProfessionalClientIds } from "@/server/queries";

const METHOD_ICON = { boleto: Banknote, link: Link2, pix: QrCode };

export async function InvoicesList({
  clientId,
  professionalId,
}: {
  clientId?: string;
  professionalId?: string;
} = {}) {
  await requireStaff();
  const supabase = await createClient();

  let query = supabase.from("invoices").select("*").order("due_date", { ascending: true });
  let clientsQuery = supabase
    .from("clients")
    .select("id, company_name")
    .eq("status", "active")
    .order("company_name");

  if (clientId) {
    query = query.eq("client_id", clientId);
  } else if (professionalId) {
    const ids = await loadProfessionalClientIds(supabase, professionalId);
    query = query.in("client_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    clientsQuery = clientsQuery.eq("professional_id", professionalId);
  }

  const [{ data: invoices }, { data: clients }] = await Promise.all([query, clientsQuery]);

  const rows = invoices ?? [];
  const clientOptions = (clients ?? []).map((client) => ({
    id: client.id,
    companyName: client.company_name,
  }));

  const names = await loadClientNames(
    supabase,
    rows.map((row) => row.client_id),
  );

  const boletoUrls = await Promise.all(
    rows.map((row) =>
      row.boleto_file_path
        ? signedDownloadUrl(supabase, BUCKETS.invoices, row.boleto_file_path, `${safeFileName(row.title)}.pdf`)
        : Promise.resolve(null),
    ),
  );

  return (
    <>
      <PageHeader
        title="Cobrancas"
        description="Boleto, link de pagamento ou chave Pix — envie e acompanhe o que esta em aberto."
        actions={<InvoiceCreateModal clients={clientOptions} defaultClientId={clientId} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Banknote className="size-5" />}
          title="Nenhuma cobranca ainda"
          description="Envie a primeira cobranca para o cliente pagar."
          action={<InvoiceCreateModal clients={clientOptions} defaultClientId={clientId} />}
        />
      ) : (
        <div className="space-y-4">
          {rows.map((invoice, index) => {
            const Icon = METHOD_ICON[invoice.method];
            const boletoUrl = boletoUrls[index] ?? null;

            return (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                clientName={clientId ? undefined : (names.get(invoice.client_id) ?? "Cliente")}
                primaryAction={
                  <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                    <Icon className="size-4 shrink-0 text-ink-400" aria-hidden />
                    {invoice.method === "boleto" ? (
                      boletoUrl ? (
                        <a href={boletoUrl} className="font-medium text-accent">
                          Baixar boleto enviado
                        </a>
                      ) : (
                        <span className="text-ink-400">Boleto ainda nao anexado</span>
                      )
                    ) : invoice.method === "link" ? (
                      <a
                        href={invoice.payment_link ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-medium text-accent"
                      >
                        {invoice.payment_link}
                      </a>
                    ) : (
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <Copy className="size-3.5 shrink-0" aria-hidden />
                        {invoice.pix_key}
                      </span>
                    )}
                    {invoice.status === "paid" ? (
                      <span className="text-xs text-ink-400">
                        Paga em {formatDate(invoice.paid_at)}
                      </span>
                    ) : null}
                  </div>
                }
                secondaryActions={<InvoiceStaffActions invoiceId={invoice.id} status={invoice.status} />}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
