import "server-only";

import { consumeAuthorizationCode } from "@/server/mcp/oauth";
import { issueApiKey } from "@/server/mcp/issue-key";

/**
 * Token endpoint do fluxo Authorization Code + PKCE. Troca o codigo de uso
 * unico (gerado em `/api/mcp/oauth/authorize` apos o consentimento) por um
 * `access_token` -- que e', na pratica, a mesma chave de API que a tela de
 * Configuracoes gera (`src/server/mcp/issue-key.ts`): sem expiracao, o
 * profissional revoga a qualquer momento no proprio Content Portal, e o
 * `/api/mcp` autentica os dois formatos do mesmo jeito.
 *
 * Aceita `application/x-www-form-urlencoded` (padrao OAuth) e JSON, pra
 * cobrir implementacoes de cliente diferentes sem exigir um dos dois.
 */
function corsHeaders() {
  return { "Access-Control-Allow-Origin": "*" };
}

async function readBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    return typeof json === "object" && json !== null ? (json as Record<string, string>) : {};
  }
  const form = await request.formData().catch(() => null);
  if (!form) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

export async function POST(request: Request) {
  const body = await readBody(request);

  if (body.grant_type !== "authorization_code") {
    return Response.json(
      { error: "unsupported_grant_type" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier } = body;
  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return Response.json(
      { error: "invalid_request", error_description: "Faltam parametros obrigatorios." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const consumed = await consumeAuthorizationCode({ code, clientId, redirectUri, codeVerifier });
  if (!consumed.ok) {
    return Response.json({ error: "invalid_grant" }, { status: 400, headers: corsHeaders() });
  }

  const issued = await issueApiKey(consumed.data.professionalId, "Claude (conector)");
  if (!issued.ok) {
    return Response.json(
      { error: "server_error", error_description: issued.error },
      { status: 500, headers: corsHeaders() },
    );
  }

  return Response.json(
    { access_token: issued.data.key, token_type: "Bearer" },
    { headers: corsHeaders() },
  );
}
