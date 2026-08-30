"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ClientServiceRow } from "@/types/database";

const schema = z.object({
  clientId: z.uuid("Selecione um cliente"),
  title: z.string().trim().min(2, "Informe o nome do servico"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  currency: z.enum(["BRL", "USD", "EUR", "GBP"]),
});

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
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      position: count ?? 0,
      created_by: actor.authUser.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel adicionar o servico."));
  }

  revalidateServices(parsed.data.clientId);
  return ok(data);
}

const updateSchema = schema.omit({ clientId: true });

export async function updateClientServiceAction(
  serviceId: string,
  input: z.input<typeof updateSchema>,
): Promise<ActionResult<null>> {
  await requireStaff();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_services")
    .update({
      title: parsed.data.title,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
    })
    .eq("id", serviceId)
    .select("client_id")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel atualizar o servico."));
  }

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
