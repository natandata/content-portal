import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logClientActivity } from "@/server/activity";
import { assertClientOwnership, type McpActor } from "@/server/mcp/auth";
import { describeError, fail, ok, type ActionResult } from "@/server/result";
import type { ClientServiceRow, CurrencyCode } from "@/types/database";

const CURRENCIES: CurrencyCode[] = ["BRL", "USD", "EUR", "GBP"];

/**
 * Adiciona um servico contratado -- mesma logica de
 * `createClientServiceAction` (`src/server/actions/client-services.ts`),
 * mais o campo `startDate` (data combinada de inicio deste servico).
 */
export async function addClientServiceTool(
  actor: McpActor,
  input: {
    clientId: string;
    title: string;
    amount?: number;
    currency?: string;
    isPartnership?: boolean;
    startDate?: string;
  },
): Promise<ActionResult<ClientServiceRow>> {
  if (!input.title?.trim() || input.title.trim().length < 2) return fail("Informe o nome do servico.");

  const isPartnership = Boolean(input.isPartnership);
  if (!isPartnership && !(typeof input.amount === "number" && input.amount > 0)) {
    return fail("Informe um valor maior que zero (ou marque como parceria).");
  }

  const currency = (input.currency ?? "BRL").toUpperCase();
  if (!CURRENCIES.includes(currency as CurrencyCode)) return fail("Moeda invalida (use BRL, USD, EUR ou GBP).");

  if (input.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return fail("Data de inicio invalida (use AAAA-MM-DD).");
  }

  const admin = createAdminClient();
  const ownership = await assertClientOwnership(admin, actor, input.clientId);
  if (!ownership.ok) return ownership;

  const { count } = await admin
    .from("client_services")
    .select("id", { count: "exact", head: true })
    .eq("client_id", input.clientId);

  const { data, error } = await admin
    .from("client_services")
    .insert({
      client_id: input.clientId,
      title: input.title,
      amount: isPartnership ? null : input.amount!,
      currency: currency as CurrencyCode,
      is_partnership: isPartnership,
      start_date: input.startDate ?? null,
      position: count ?? 0,
      created_by: actor.userId,
    })
    .select("*")
    .single();

  if (error || !data) return fail(describeError(error, "Nao foi possivel adicionar o servico."));

  await logClientActivity(
    admin,
    input.clientId,
    actor.displayName,
    `Adicionou o servico "${data.title}"${data.is_partnership ? " (parceria)" : ""}`,
  );

  return ok(data);
}
