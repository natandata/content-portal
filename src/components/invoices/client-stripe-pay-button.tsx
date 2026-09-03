"use client";

import { useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { startInvoiceCheckoutAction } from "@/server/actions/stripe-checkout";

/**
 * Primeira acao que a tela do cliente dispara — ate aqui tudo era copiar,
 * baixar ou abrir em outra aba. Mesma aparencia do CopyButton ao lado.
 */
export function ClientStripePayButton({
  invoiceId,
  label,
  processingLabel,
}: {
  invoiceId: string;
  label: string;
  processingLabel: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await startInvoiceCheckoutAction(invoiceId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.location.assign(result.data.url);
        })
      }
      className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink-900 text-sm font-medium text-on-ink transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <CreditCard className="size-4" aria-hidden />
      )}
      {pending ? processingLabel : label}
    </button>
  );
}
