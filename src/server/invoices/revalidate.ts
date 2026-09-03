import { revalidatePath } from "next/cache";

/**
 * Telas que mudam quando uma cobranca e criada, paga ou apagada.
 *
 * Mora fora de `server/actions/invoices.ts` porque o webhook da Stripe tambem
 * precisa disso e nao pode importar de um arquivo `"use server"` sem virar uma
 * server action exposta.
 */
export function revalidateInvoices(clientId?: string) {
  revalidatePath("/admin/payments");
  revalidatePath("/professional/payments");
  revalidatePath("/client/payments");
  revalidatePath("/client/dashboard");
  revalidatePath("/admin/dashboard");
  revalidatePath("/professional/dashboard");

  if (clientId) {
    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath(`/professional/clients/${clientId}`);
  }
}
