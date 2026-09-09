/**
 * Telas que mudam quando uma cobranca e criada, paga ou apagada.
 *
 * Mora fora de `server/actions/invoices.ts` porque o webhook da Stripe tambem
 * precisa disso e nao pode importar de um arquivo `"use server"` sem virar uma
 * server action exposta.
 *
 * `next/cache` e importado dinamicamente (nao no topo do modulo) pro worker
 * do Railway (invoice-recurrence, invoice-reminders): fora do build do Next,
 * ate resolver o modulo falha, e um `import` estatico falharia antes mesmo
 * do try/catch rodar. Ninguem no app aguarda esta funcao hoje (chamada
 * fire-and-forget antes do `return`), entao virar `async` nao muda
 * comportamento nenhum -- so adia por um microtask.
 */
export async function revalidateInvoices(clientId?: string) {
  try {
    const { revalidatePath } = await import("next/cache");

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
  } catch {
    // Fora de um contexto de requisicao do Next (worker do Railway) -- o
    // dado ja esta correto no banco, so a revalidacao de cache nao se aplica.
  }
}
