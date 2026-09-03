import { Banknote, Clock } from "lucide-react";

import {
  ClientBoletoDownload,
  ClientCopyLink,
  ClientCopyPixKey,
} from "@/components/invoices/client-invoice-actions";
import { ClientStripePayButton } from "@/components/invoices/client-stripe-pay-button";
import { InvoiceCard } from "@/components/invoices/invoice-card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { BUCKETS } from "@/lib/paths";
import { signedDownloadUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { safeFileName } from "@/lib/utils";
import type { InvoiceRow } from "@/types/database";

/**
 * Boleto e Pix ficam ate dois dias uteis entre "cliente concluiu o checkout" e
 * "dinheiro confirmado". Sem dizer isso, o cliente acha que o pagamento nao
 * pegou e paga de novo.
 */
function ClientStripeState({
  invoice,
  dict,
}: {
  invoice: InvoiceRow;
  dict: { payProcessing: string; payProcessingHint: string; payFailed: string; payReopen: string };
}) {
  const hostedStillValid =
    invoice.stripe_hosted_url &&
    invoice.stripe_hosted_url_expires_at &&
    new Date(invoice.stripe_hosted_url_expires_at).getTime() > Date.now();

  if (invoice.stripe_payment_status === "processing") {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
          <Clock className="size-4 shrink-0" aria-hidden />
          {dict.payProcessing}
        </p>
        <p className="text-xs text-ink-500">{dict.payProcessingHint}</p>
        {hostedStillValid ? (
          <a
            href={invoice.stripe_hosted_url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="focus-ring text-sm font-medium text-accent"
          >
            {dict.payReopen}
          </a>
        ) : null}
      </div>
    );
  }

  if (invoice.stripe_payment_status === "failed") {
    return <p className="text-sm text-red-600">{dict.payFailed}</p>;
  }

  return null;
}

export async function ClientInvoices() {
  await requireClientActor();
  const supabase = await createClient();
  const { locale, dict } = await getServerDictionary();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true });

  const rows = invoices ?? [];

  const boletoUrls = await Promise.all(
    rows.map((row) =>
      row.boleto_file_path
        ? signedDownloadUrl(supabase, BUCKETS.invoices, row.boleto_file_path, `${safeFileName(row.title)}.pdf`)
        : Promise.resolve(null),
    ),
  );

  return (
    <>
      <PageHeader title={dict.invoices.title} description={dict.invoices.subtitle} />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Banknote className="size-5" />}
          title={dict.invoices.empty}
          description={dict.invoices.emptyBody}
        />
      ) : (
        <div className="space-y-4">
          {rows.map((invoice, index) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              locale={locale}
              primaryAction={
                invoice.method === "boleto" ? (
                  <ClientBoletoDownload
                    url={boletoUrls[index] ?? null}
                    label={dict.invoices.downloadBoleto}
                    unavailableLabel={dict.invoices.boletoUnavailable}
                  />
                ) : invoice.method === "link" ? (
                  <div className="space-y-2">
                    <ClientCopyLink link={invoice.payment_link ?? ""} label={dict.invoices.copyLink} />
                    <a
                      href={invoice.payment_link ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring block text-center text-sm font-medium text-accent"
                    >
                      {dict.invoices.openLink}
                    </a>
                  </div>
                ) : invoice.method === "pix" ? (
                  <ClientCopyPixKey pixKey={invoice.pix_key ?? ""} label={dict.invoices.copyPix} />
                ) : invoice.status === "open" && invoice.stripe_payment_status !== "processing" ? (
                  <ClientStripePayButton
                    invoiceId={invoice.id}
                    label={dict.invoices.payNow}
                    processingLabel={dict.invoices.payOpening}
                  />
                ) : null
              }
              secondaryActions={
                invoice.method === "stripe" && invoice.status === "open" ? (
                  <ClientStripeState invoice={invoice} dict={dict.invoices} />
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
