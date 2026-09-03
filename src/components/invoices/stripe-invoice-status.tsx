import { Clock, XCircle } from "lucide-react";

import type { InvoiceRow } from "@/types/database";

/**
 * Estado do pagamento online na visao da equipe.
 *
 * `stripe_payment_status` e mais granular que `invoices.status`: boleto e Pix
 * ficam em "processing" por ate dois dias uteis depois do cliente concluir o
 * checkout, com a cobranca ainda em aberto. Sem mostrar isso, a equipe cobra de
 * novo um cliente que ja pagou.
 */
export function StripeInvoiceStatus({ invoice }: { invoice: InvoiceRow }) {
  if (invoice.status === "paid") {
    return <span className="text-ink-500">Pago online</span>;
  }

  if (invoice.stripe_payment_status === "processing") {
    return (
      <span className="flex items-center gap-1.5 font-medium text-amber-600">
        <Clock className="size-3.5 shrink-0" aria-hidden />
        Pagamento em processamento
      </span>
    );
  }

  if (invoice.stripe_payment_status === "failed") {
    return (
      <span className="flex items-center gap-1.5 font-medium text-red-600">
        <XCircle className="size-3.5 shrink-0" aria-hidden />
        Pagamento nao concluido
      </span>
    );
  }

  return <span className="text-ink-400">Aguardando o cliente pagar</span>;
}
