import "server-only";

import { z } from "zod";

import { registerOAuthClient } from "@/server/mcp/oauth";

/**
 * RFC 7591 -- Dynamic Client Registration. E' isso que falha hoje sem essa
 * rota ("Couldn't register with Content's sign-in service"): o conector do
 * claude.ai/app registra a si mesmo aqui na primeira vez que voce clica
 * "Connect", antes de qualquer tela de autorizacao aparecer. Cliente
 * publico -- nao emitimos client_secret, so um client_id.
 */
const schema = z.object({
  redirect_uris: z.array(z.string().url()).min(1),
  client_name: z.string().trim().max(200).optional(),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_client_metadata", error_description: parsed.error.issues[0]?.message },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const result = await registerOAuthClient({
    redirectUris: parsed.data.redirect_uris,
    clientName: parsed.data.client_name,
  });
  if (!result.ok) {
    return Response.json(
      { error: "invalid_client_metadata", error_description: result.error },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  return Response.json(
    {
      client_id: result.data.client_id,
      client_id_issued_at: Math.floor(new Date(result.data.created_at).getTime() / 1000),
      redirect_uris: result.data.redirect_uris,
      client_name: result.data.client_name ?? undefined,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    { status: 201, headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
