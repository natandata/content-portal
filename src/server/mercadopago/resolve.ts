import { refreshMercadoPagoTokens } from "@/lib/mercadopago/client";
import { fail, ok, type ActionResult } from "@/server/result";
import type { createAdminClient, createClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Access Token pronto pra uso da conta Mercado Pago de um profissional --
 * renova sozinho quando estiver a menos de 7 dias de vencer (o access_token
 * dura 180 dias). Chamado tanto na criacao do Pix quanto no webhook.
 *
 * Nao e "use server" (mesmo motivo de `server/invoices/mark-paid.ts`): recebe
 * o client admin ja pronto em vez de criar o proprio, entao nao serve como
 * Server Action isolada.
 */
export async function resolveMercadoPagoAccessToken(
  admin: AdminClient,
  professionalId: string,
): Promise<{ accessToken: string } | null> {
  const { data: account } = await admin
    .from("professional_mercadopago_accounts")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", professionalId)
    .maybeSingle();

  if (!account) return null;

  const expiresInMs = new Date(account.token_expires_at).getTime() - Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (expiresInMs > sevenDaysMs) return { accessToken: account.access_token };

  const refreshed = await refreshMercadoPagoTokens(account.refresh_token);
  if (!refreshed) {
    // Refresh falhou -- token atual ainda pode funcionar ate vencer de vez;
    // deixa quem chamou tentar usar e falhar la, com mensagem clara, em vez
    // de bloquear aqui um token que ainda pode estar valido.
    return { accessToken: account.access_token };
  }

  await admin
    .from("professional_mercadopago_accounts")
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      token_expires_at: new Date(refreshed.expiresAt).toISOString(),
    })
    .eq("user_id", professionalId);

  return { accessToken: refreshed.accessToken };
}

/**
 * Resolve, a partir do cliente, qual profissional tem conta Mercado Pago
 * conectada -- mesmo espirito de `resolveStripeAccountForClient` em
 * `server/actions/invoices.ts`.
 */
export async function resolveMercadoPagoProfessionalForClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: AdminClient,
  clientId: string,
): Promise<ActionResult<string>> {
  const { data: client } = await supabase
    .from("clients")
    .select("professional_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.professional_id) {
    return fail("Este cliente nao tem profissional responsavel para receber o Pix.");
  }

  const { data: account } = await admin
    .from("professional_mercadopago_accounts")
    .select("user_id")
    .eq("user_id", client.professional_id)
    .maybeSingle();

  if (!account) {
    return fail("O profissional responsavel ainda nao conectou a conta Mercado Pago.");
  }

  return ok(account.user_id);
}
