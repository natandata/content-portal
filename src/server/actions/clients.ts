"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActor, requireStaff } from "@/lib/auth";
import { COVER_PALETTE } from "@/lib/cover-palette";
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
  tag: z.string().trim().max(40).optional(),
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

  const { name, companyName, email, phone, professionalId, tag } = parsed.data;
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
      tag: tag || null,
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

  const { id, name, companyName, email, phone, professionalId, status, tag } = parsed.data;
  const supabase = await createClient();

  const payload: Partial<ClientRow> = {
    name,
    company_name: companyName,
    email: email ? email.toLowerCase() : null,
    phone: phone || null,
    status,
    tag: tag || null,
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

export async function deleteClientAction(id: string): Promise<ActionResult<null>> {
  await requireStaff();

  if (!id || typeof id !== "string") {
    return fail("ID do cliente invalido.");
  }

  const supabase = await createClient();

  // Verificar se o cliente existe e se o usuario tem permissao (via RLS)
  const { data: client, error: selectError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (selectError || !client) {
    return fail(
      describeError(selectError, "Cliente nao encontrado ou sem permissao para deletar."),
    );
  }

  // Realizar o delete - RLS vai validar novamente
  const { error: deleteError } = await supabase.from("clients").delete().eq("id", id);

  if (deleteError) {
    return fail(describeError(deleteError, "Nao foi possivel deletar o cliente."));
  }

  revalidateClients();
  revalidatePath("/admin/clients");
  revalidatePath("/professional/clients");
  return done();
}

/**
 * Capa do cliente: mesma cor exibida no card da galeria e no topo da tela do
 * cliente. So cor de proposito — nada de upload de imagem aqui.
 */
export async function updateClientCoverColorAction(
  clientId: string,
  color: string,
): Promise<ActionResult<null>> {
  await requireStaff();

  if (!Object.hasOwn(COVER_PALETTE, color)) {
    return fail("Cor invalida.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ cover_color: color }).eq("id", clientId);

  if (error) {
    return fail(describeError(error, "Nao foi possivel salvar a cor da capa."));
  }

  revalidateClients();
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
  return done();
}

/**
 * Foto de perfil do cliente. Fica em `client_profiles.avatar_path` — o mesmo
 * registro da simulacao do feed — para nao duplicar coluna. Quem chama pode
 * ser a equipe (gerenciando qualquer cliente dela) ou o proprio cliente
 * (so a propria conta, via RPC porque ele nao tem policy de escrita direta
 * em `client_profiles`).
 */
export async function updateClientAvatarAction(
  clientId: string,
  avatarPath: string | null,
): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  if (actor.role === "client") {
    if (!actor.client || actor.client.id !== clientId) {
      return fail("Voce so pode editar a propria foto.");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_client_avatar", { p_avatar_path: avatarPath });
    if (error) return fail(describeError(error, "Nao foi possivel salvar a foto."));
  } else {
    if (actor.role !== "admin" && actor.role !== "professional") return fail("Sem permissao.");
    const supabase = await createClient();
    const { error } = await supabase
      .from("client_profiles")
      .upsert({ client_id: clientId, avatar_path: avatarPath }, { onConflict: "client_id" });
    if (error) return fail(describeError(error, "Nao foi possivel salvar a foto."));
  }

  revalidateClients();
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
  revalidatePath("/client/settings");
  return done();
}
