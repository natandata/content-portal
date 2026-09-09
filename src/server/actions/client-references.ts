"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { normalizeExternalUrl } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ClientReferenceRow } from "@/types/database";

const schema = z.object({
  clientId: z.uuid("Selecione um cliente"),
  title: z.string().trim().min(2, "Informe o titulo da referencia"),
  url: z
    .string()
    .trim()
    .transform((value) => normalizeExternalUrl(value))
    .refine((value): value is string => value !== null, "Link invalido: use um endereco http(s)."),
});

function revalidateReferences(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
  revalidatePath("/client/dashboard");
}

export async function createClientReferenceAction(
  input: z.input<typeof schema>,
): Promise<ActionResult<ClientReferenceRow>> {
  const actor = await requireStaff();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("client_references")
    .select("id", { count: "exact", head: true })
    .eq("client_id", parsed.data.clientId);

  const { data, error } = await supabase
    .from("client_references")
    .insert({
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      url: parsed.data.url,
      position: count ?? 0,
      created_by: actor.authUser.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel adicionar a referencia."));
  }

  await logClientActivity(
    supabase,
    parsed.data.clientId,
    actor.displayName,
    `Adicionou uma referencia: "${data.title}"`,
  );

  revalidateReferences(parsed.data.clientId);
  return ok(data);
}

const updateSchema = schema.omit({ clientId: true });

export async function updateClientReferenceAction(
  referenceId: string,
  input: z.input<typeof updateSchema>,
): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_references")
    .update({ title: parsed.data.title, url: parsed.data.url })
    .eq("id", referenceId)
    .select("client_id")
    .single();

  if (error || !data) {
    return fail(describeError(error, "Nao foi possivel atualizar a referencia."));
  }

  await logClientActivity(
    supabase,
    data.client_id,
    actor.displayName,
    `Atualizou a referencia "${parsed.data.title}"`,
  );

  revalidateReferences(data.client_id);
  return done();
}

export async function deleteClientReferenceAction(referenceId: string): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { data: reference } = await supabase
    .from("client_references")
    .select("client_id")
    .eq("id", referenceId)
    .maybeSingle();

  if (!reference) return fail("Referencia nao encontrada.");

  const { error } = await supabase.from("client_references").delete().eq("id", referenceId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel excluir a referencia."));
  }

  revalidateReferences(reference.client_id);
  return done();
}
