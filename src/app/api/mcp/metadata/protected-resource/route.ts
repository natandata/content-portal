import "server-only";

import { appBaseUrl } from "@/lib/env";

/**
 * RFC 9728 -- OAuth 2.0 Protected Resource Metadata. Reescrito de
 * `/.well-known/oauth-protected-resource` (e da variante com o caminho do
 * recurso anexado) via rewrite em `next.config.ts`. Aponta o conector pro
 * servidor de autorizacao (`authorization-server`, acima) que descreve o
 * fluxo de fato.
 */
export async function GET() {
  const base = appBaseUrl();

  return Response.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
