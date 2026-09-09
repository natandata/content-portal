"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ClientServiceRow } from "@/types/database";

// Parceria = servico sem cobranca em dinheiro (permuta, cortesia, troca de
// divulgacao) -- Valor/Moeda ficam sem sentido nesse caso, entao so exigimos
// valor > 0 quando NAO for parceria (mesmo estilo de `.refine()` condicional
// que createSchema usa em invoices.ts pra paymentLink/pixKey).
const baseServiceFields = z.object({
  title: z.string().trim().min(2, "Informe o nome do servico"),
  isPartnership: z.boolean().default(false),
  amount: z.coerce.number().optional(),
  currency: z.enum(["BRL", "USD", "EUR", "GBP"]).default("BRL"),
});

function withAmountRule<T extends typeof baseServiceFields>(base: T) {
  return base.refine(
    (data) => data.isPartnership || (data.amount !== undefined && data.amount > 0),
    { message: "Informe um valor maior que zero.", path: ["amount"] },
  );
}

const schema = withAmountRule(baseServiceFields.extend({ clientId: z.uuid("Selecione um cliente") }));

function revalidateServices(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
  revalidatePath("/client/dashboard");
}

export async function createClientServiceAction(
  input: z.input<typeof schema>,
): Promise<ActionResult<ClientServiceRow>> {
  const actor = await requireStaff();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("client_services")
    .select("id", { count: "exact", head: true })
    .eq("client_id", parsed.data.clientId);

  const { data, error } = await supabase
    .from("client_services")
    .insert({
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      amount: parsed.data.isPartnership ? null : parsed.data.amount!,
      currency: parsed.data.currency,
      is_partnership: parsed.data.isPartnership,
      position: count ?? 0,
      created_by: actor.authUser.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel adicionar o servico."));
  }

  await logClientActivity(
    supabase,
    parsed.data.clientId,
    actor.displayName,
    `Adicionou o servico "${data.title}"${data.is_partnership ? " (parceria)" : ""}`,
  );

  revalidateServices(parsed.data.clientId);
  return ok(data);
}

const updateSchema = withAmountRule(baseServiceFields);

export async function updateClientServiceAction(
  serviceId: string,
  input: z.input<typeof updateSchema>,
): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_services")
    .update({
      title: parsed.data.title,
      amount: parsed.data.isPartnership ? null : parsed.data.amount!,
      currency: parsed.data.currency,
      is_partnership: parsed.data.isPartnership,
    })
    .eq("id", serviceId)
    .select("client_id")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel atualizar o servico."));
  }

  await logClientActivity(
    supabase,
    data.client_id,
    actor.displayName,
    `Atualizou o servico "${parsed.data.title}"${parsed.data.isPartnership ? " (parceria)" : ""}`,
  );

  revalidateServices(data.client_id);
  return done();
}

export async function deleteClientServiceAction(serviceId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("client_services")
    .select("client_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (!service) return fail("Servico nao encontrado.");

  const { error } = await supabase.from("client_services").delete().eq("id", serviceId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir o servico."));
  }

  revalidateServices(service.client_id);
  return done();
}
