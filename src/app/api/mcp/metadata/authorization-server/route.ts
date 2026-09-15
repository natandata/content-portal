import "server-only";

import { appBaseUrl } from "@/lib/env";

/**
 * RFC 8414 -- OAuth 2.0 Authorization Server Metadata. Reescrito de
 * `/.well-known/oauth-authorization-server` via rewrite (`next.config.ts`).
 * Cliente publico (sem client_secret): so PKCE (S256) autentica o token
 * endpoint. Ver `src/server/mcp/oauth.ts` pra logica e
 * `src/app/api/mcp/oauth/*` pros endpoints.
 */
export async function GET() {
  const base = appBaseUrl();

  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/api/mcp/oauth/authorize`,
      token_endpoint: `${base}/api/mcp/oauth/token`,
      registration_endpoint: `${base}/api/mcp/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
