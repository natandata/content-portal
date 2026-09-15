import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { logClientActivity } from "@/server/activity";
import type { McpActor } from "@/server/mcp/auth";
import { describeError, fail, ok, type ActionResult } from "@/server/result";
import type { ClientRow } from "@/types/database";

const CLIENT_AUTH_DOMAIN = "clients.contentportal.app";

/**
 * Cadastra um cliente -- mesma logica de `createClientAction`
 * (`src/server/actions/clients.ts`), reescrita sem cookie de sessao (usa
 * admin client direto, chamado a partir de uma ferramenta MCP).
 */
export async function createClientTool(
  actor: McpActor,
  input: { name: string; companyName: string; email?: string; phone?: string; tag?: string; professionalId?: string },
): Promise<ActionResult<{ id: string; accessCode: string }>> {
  if (!input.name?.trim() || input.name.trim().length < 2) return fail("Informe o nome do contato.");
  if (!input.companyName?.trim() || input.companyName.trim().length < 2) return fail("Informe o nome da empresa.");

  const admin = createAdminClient();

  // So admin pode atribuir a um profissional especifico; uma chave de
  // profissional sempre cria sob a propria responsabilidade.
  const ownerId = actor.role === "admin" ? (input.professionalId || null) : actor.userId;

  const { data: accessCode, error: codeError } = await admin.rpc("generate_access_code", {
    p_seed: input.companyName,
  });
  if (codeError || !accessCode) {
    return fail(describeError(codeError, "Nao foi possivel gerar o codigo de acesso."));
  }

  const authEmail = `${accessCode.toLowerCase()}@${CLIENT_AUTH_DOMAIN}`;
  const authPassword = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: authPassword,
    email_confirm: true,
    app_metadata: { role: "client" },
    user_metadata: { company_name: input.companyName },
  });
  if (authError || !created.user) {
    return fail(describeError(authError, "Nao foi possivel criar o acesso do cliente."));
  }
  const authUserId = created.user.id;

  const { data: client, error: insertError } = await admin
    .from("clients")
    .insert({
      name: input.name,
      company_name: input.companyName,
      email: input.email ? input.email.toLowerCase() : null,
      phone: input.phone || null,
      access_code: accessCode,
      professional_id: ownerId,
      auth_user_id: authUserId,
      tag: input.tag || null,
    })
    .select("*")
    .single<ClientRow>();

  if (insertError || !client) {
    await admin.auth.admin.deleteUser(authUserId);
    return fail(describeError(insertError, "Nao foi possivel criar o cliente."));
  }

  const { error: credentialError } = await admin.from("client_credentials").insert({
    client_id: client.id,
    auth_email: authEmail,
    auth_password: authPassword,
  });
  if (credentialError) {
    await admin.from("clients").delete().eq("id", client.id);
    await admin.auth.admin.deleteUser(authUserId);
    return fail(describeError(credentialError, "Nao foi possivel salvar o acesso do cliente."));
  }

  await admin.auth.admin.updateUserById(authUserId, {
    app_metadata: { role: "client", client_id: client.id },
  });

  await logClientActivity(admin, client.id, actor.displayName, "Cadastrou o cliente");

  return ok({ id: client.id, accessCode: client.access_code });
}

/** Busca clientes por nome/empresa, escopado ao ator (admin ve todos; profissional so os proprios). */
export async function findClientTool(
  actor: McpActor,
  query: string,
): Promise<ActionResult<{ id: string; name: string; companyName: string }[]>> {
  if (!query?.trim()) return fail("Informe um termo de busca.");

  const admin = createAdminClient();
  let builder = admin
    .from("clients")
    .select("id, name, company_name")
    .or(`company_name.ilike.%${query}%,name.ilike.%${query}%`)
    .order("company_name")
    .limit(10);

  if (actor.role !== "admin") builder = builder.eq("professional_id", actor.userId);

  const { data, error } = await builder;
  if (error) return fail(describeError(error, "Nao foi possivel buscar clientes."));

  return ok((data ?? []).map((row) => ({ id: row.id, name: row.name, companyName: row.company_name })));
}
