import { Banknote, Copy, CreditCard, Link2, QrCode } from "lucide-react";

import { InvoiceCard } from "@/components/invoices/invoice-card";
import { InvoiceCreateModal } from "@/components/invoices/invoice-create-modal";
import { InvoiceStaffActions } from "@/components/invoices/invoice-staff-actions";
import { StripeInvoiceStatus } from "@/components/invoices/stripe-invoice-status";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader, StatCard } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { formatMoney } from "@/lib/domain";
import { BUCKETS } from "@/lib/paths";
import { signedDownloadUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { formatDate, safeFileName } from "@/lib/utils";
import { loadClientNames, loadProfessionalClientIds } from "@/server/queries";
import type { CurrencyCode } from "@/types/database";

const METHOD_ICON = { boleto: Banknote, link: Link2, pix: QrCode, stripe: CreditCard, mercadopago: QrCode };

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

  // Stripe e Mercado Pago so aceitam BRL na criacao (createInvoiceAction
  // recusa outra moeda pros dois), entao somar direto aqui e seguro. Vem do
  // mesmo `rows` que a pagina ja releu nesta visita -- atualiza sozinho a
  // cada entrada na tela, sem chamada extra as APIs.
  const onlineRows = rows.filter((row) => row.method === "stripe" || row.method === "mercadopago");
  const onlineReceivable = onlineRows
    .filter((row) => row.status === "open")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const onlineReceived = onlineRows
    .filter((row) => row.status === "paid")
    .reduce(
      (sum, row) => sum + (row.amount_paid_cents != null ? row.amount_paid_cents / 100 : Number(row.amount)),
      0,
    );

  // Total pago de TODOS os metodos (boleto/link/pix manual entram aqui tambem,
  // marcados a mao pela equipe) -- agrupado por moeda porque so
  // stripe/mercadopago sao travados em BRL, os outros metodos aceitam
  // qualquer uma.
  const paidByCurrency = new Map<CurrencyCode, number>();
  for (const row of rows) {
    if (row.status !== "paid") continue;
    const amount = row.amount_paid_cents != null ? row.amount_paid_cents / 100 : Number(row.amount);
    paidByCurrency.set(row.currency, (paidByCurrency.get(row.currency) ?? 0) + amount);
  }

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

      {!clientId ? (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Pagamento online</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="A receber"
              value={formatMoney(onlineReceivable, "BRL")}
              hint="Stripe ou Mercado Pago, ainda em aberto"
              tone="warning"
            />
            <StatCard
              label="Pagas"
              value={formatMoney(onlineReceived, "BRL")}
              hint="Ja confirmadas pela Stripe ou Mercado Pago"
              tone="success"
            />
          </div>

          {/* Total pago de TODOS os metodos -- boleto/link/pix manual so
              entram como "pago" quando a equipe marca na mao, entao nao da
              pra saber sem somar aqui tambem (pedido explicito do usuario). */}
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">
              Total marcado como pago (todos os metodos)
            </h3>
            {paidByCurrency.size === 0 ? (
              <p className="text-sm text-ink-500">Nenhuma cobranca paga ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {Array.from(paidByCurrency.entries()).map(([currency, amount]) => (
                  <div key={currency} className="rounded-xl border border-line bg-surface p-3.5">
                    <p className="text-xl font-bold tabular-nums tracking-tight text-emerald-700">
                      {formatMoney(amount, currency)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
                      {currency}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : null}

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
                    ) : invoice.method === "pix" ? (
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <Copy className="size-3.5 shrink-0" aria-hidden />
                        {invoice.pix_key}
                      </span>
                    ) : (
                      <StripeInvoiceStatus invoice={invoice} />
                    )}
                    {invoice.status === "paid" ? (
                      <span className="text-xs text-ink-400">
                        Paga em {formatDate(invoice.paid_at)}
                      </span>
                    ) : null}
                  </div>
                }
                secondaryActions={
                  <InvoiceStaffActions
                    invoiceId={invoice.id}
                    status={invoice.status}
                    method={invoice.method}
                    recurrenceActive={
                      Boolean(invoice.recurrence_group_id) &&
                      !invoice.recurrence_cancelled &&
                      (invoice.recurrence_total_cycles == null ||
                        (invoice.recurrence_cycle_number ?? 0) < invoice.recurrence_total_cycles)
                    }
                  />
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
