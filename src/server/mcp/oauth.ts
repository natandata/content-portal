import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { describeError, fail, ok, type ActionResult } from "@/server/result";
import type { McpOAuthClientRow } from "@/types/database";

/**
 * Servidor de autorizacao OAuth 2.1 (Authorization Code + PKCE, sem
 * client_secret -- cliente publico) minimo, so o suficiente pro fluxo de
 * conector do claude.ai/app: registro dinamico de cliente (RFC 7591),
 * autorizacao (com consentimento na propria sessao logada do Content
 * Portal) e troca do codigo por uma chave de API (ver
 * `src/server/mcp/issue-key.ts`). Rotas em `src/app/api/mcp/oauth/*` e
 * metadados em `src/app/.well-known/*`.
 */

const CODE_TTL_MS = 5 * 60 * 1000;

export async function findOAuthClient(clientId: string): Promise<McpOAuthClientRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("mcp_oauth_clients").select("*").eq("client_id", clientId).maybeSingle();
  return data ?? null;
}

export async function registerOAuthClient(input: {
  redirectUris: string[];
  clientName?: string;
}): Promise<ActionResult<McpOAuthClientRow>> {
  if (input.redirectUris.length === 0) return fail("Informe ao menos um redirect_uri.");

  const admin = createAdminClient();
  const clientId = randomBytes(16).toString("hex");

  const { data, error } = await admin
    .from("mcp_oauth_clients")
    .insert({ client_id: clientId, client_name: input.clientName ?? null, redirect_uris: input.redirectUris })
    .select("*")
    .single();

  if (error || !data) return fail(describeError(error, "Nao foi possivel registrar o conector."));
  return ok(data);
}

/** Gerado apos o profissional confirmar o consentimento -- de uso unico, expira em 5 minutos. */
export async function createAuthorizationCode(input: {
  clientId: string;
  professionalId: string;
  redirectUri: string;
  codeChallenge: string;
}): Promise<ActionResult<string>> {
  const admin = createAdminClient();
  const code = randomBytes(32).toString("base64url");

  const { error } = await admin.from("mcp_oauth_codes").insert({
    code,
    client_id: input.clientId,
    professional_id: input.professionalId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });

  if (error) return fail(describeError(error, "Nao foi possivel gerar o codigo de autorizacao."));
  return ok(code);
}

/** PKCE S256: base64url(sha256(code_verifier)) precisa bater com o code_challenge salvo. */
function pkceMatches(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}

/** Valida e consome (uso unico) o codigo de autorizacao, devolvendo quem autorizou. */
export async function consumeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<ActionResult<{ professionalId: string }>> {
  const admin = createAdminClient();

  const { data: record } = await admin
    .from("mcp_oauth_codes")
    .select("*")
    .eq("code", input.code)
    .maybeSingle();

  if (!record) return fail("invalid_grant");
  if (record.used_at) return fail("invalid_grant");
  if (new Date(record.expires_at).getTime() < Date.now()) return fail("invalid_grant");
  if (record.client_id !== input.clientId) return fail("invalid_grant");
  if (record.redirect_uri !== input.redirectUri) return fail("invalid_grant");
  if (!pkceMatches(input.codeVerifier, record.code_challenge)) return fail("invalid_grant");

  // Uso unico -- marca antes de devolver sucesso, mesmo se o passo seguinte falhar depois.
  const { error: updateError } = await admin
    .from("mcp_oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", input.code)
    .is("used_at", null);
  if (updateError) return fail("invalid_grant");

  return ok({ professionalId: record.professional_id });
}
