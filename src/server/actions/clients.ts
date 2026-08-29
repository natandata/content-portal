"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { ClientRow } from "@/types/database";

const CLIENT_AUTH_DOMAIN = "clients.contentportal.app";

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do contato"),
  companyName: z.string().trim().min(2, "Informe o nome da empresa"),
  email: z.union([z.email("Email invalido"), z.literal("")]).optional(),
  phone: z.string().trim().max(30).optional(),
  professionalId: z.union([z.uuid(), z.literal("")]).optional(),
});

const updateSchema = createSchema.extend({
  id: z.uuid(),
  status: z.enum(["active", "inactive"]),
});

function revalidateClients() {
  revalidatePath("/admin/clients");
  revalidatePath("/professional/clients");
  revalidatePath("/admin/dashboard");
  revalidatePath("/professional/dashboard");
}

export async function createClientAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<ClientRow>> {
  const actor = await requireStaff();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const { name, companyName, email, phone, professionalId } = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  // Um profissional so pode criar clientes sob a propria responsabilidade.
  const ownerId =
    actor.role === "admin" ? (professionalId || null) : actor.authUser.id;

  const { data: accessCode, error: codeError } = await supabase.rpc("generate_access_code", {
    p_seed: companyName,
  });

  if (codeError || !accessCode) {
    return fail(describeError(codeError, "Nao foi possivel gerar o codigo de acesso."));
  }

  // O codigo de acesso e trocado por uma sessao Supabase real no login; para
  // isso cada cliente tem um usuario de autenticacao dedicado.
  const authEmail = `${accessCode.toLowerCase()}@${CLIENT_AUTH_DOMAIN}`;
  const authPassword = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: authPassword,
    email_confirm: true,
    app_metadata: { role: "client" },
    user_metadata: { company_name: companyName },
  });

  if (authError || !created.user) {
    return fail(describeError(authError, "Nao foi possivel criar o acesso do cliente."));
  }

  const authUserId = created.user.id;

  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert({
      name,
      company_name: companyName,
      email: email ? email.toLowerCase() : null,
      phone: phone || null,
      access_code: accessCode,
      professional_id: ownerId,
      auth_user_id: authUserId,
    })
    .select("*")
    .single();

  if (insertError || !client) {
    // Sem o registro do cliente o usuario de autenticacao nao serve para nada.
    await admin.auth.admin.deleteUser(authUserId);
    return fail(describeError(insertError, "Nao foi possivel criar o cliente."));
  }

  const { error: credentialError } = await admin.from("client_credentials").insert({
    client_id: client.id,
    auth_email: authEmail,
    auth_password: authPassword,
  });

  if (credentialError) {
    await supabase.from("clients").delete().eq("id", client.id);
    await admin.auth.admin.deleteUser(authUserId);
    return fail(describeError(credentialError, "Nao foi possivel salvar o acesso do cliente."));
  }

  await admin.auth.admin.updateUserById(authUserId, {
    app_metadata: { role: "client", client_id: client.id },
  });

  revalidateClients();
  return ok(client);
}

export async function updateClientAction(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult<ClientRow>> {
  const actor = await requireStaff();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const { id, name, companyName, email, phone, professionalId, status } = parsed.data;
  const supabase = await createClient();

  const payload: Partial<ClientRow> = {
    name,
    company_name: companyName,
    email: email ? email.toLowerCase() : null,
    phone: phone || null,
    status,
  };

  // Apenas o admin remaneja clientes entre profissionais.
  if (actor.role === "admin") {
    payload.professional_id = professionalId || null;
  }

  const { data: client, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !client) {
    return fail(describeError(error, "Nao foi possivel atualizar o cliente."));
  }

  revalidateClients();
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath(`/professional/clients/${id}`);
  return ok(client);
}

export async function setClientStatusAction(
  id: string,
  status: "active" | "inactive",
): Promise<ActionResult<null>> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase.from("clients").update({ status }).eq("id", id);
  if (error) {
    return fail(describeError(error, "Nao foi possivel alterar o status do cliente."));
  }

  revalidateClients();
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath(`/professional/clients/${id}`);
  return done();
}
