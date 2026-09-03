import { Banknote } from "lucide-react";

import {
  ClientBoletoDownload,
  ClientCopyLink,
  ClientCopyPixKey,
} from "@/components/invoices/client-invoice-actions";
import { InvoiceCard } from "@/components/invoices/invoice-card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { BUCKETS } from "@/lib/paths";
import { signedDownloadUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { safeFileName } from "@/lib/utils";

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
                ) : null
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
