import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { describeError, fail, ok, type ActionResult } from "@/server/result";

/**
 * Emissao da chave de API do assistente MCP -- compartilhada entre
 * `src/server/actions/api-keys.ts` (botao "Gerar chave" em Configuracoes,
 * atras de cookie de sessao) e `src/app/api/mcp/oauth/token/route.ts` (fim
 * do fluxo OAuth do conector do claude.ai/app: a troca do codigo por token
 * simplesmente emite uma chave dessas e devolve como `access_token`). As
 * duas emissoes acabam na mesma tabela, e `resolveMcpActor`
 * (`src/server/mcp/auth.ts`) autentica as duas do mesmo jeito.
 */

const KEY_PREFIX = "sk_live_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface IssuedApiKey {
  key: string;
  id: string;
  name: string;
  createdAt: string;
}

export async function issueApiKey(professionalId: string, name: string): Promise<ActionResult<IssuedApiKey>> {
  const admin = createAdminClient();
  const secret = randomBytes(32).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;

  const { data, error } = await admin
    .from("professional_api_keys")
    .insert({ professional_id: professionalId, name, key_hash: hashApiKey(key) })
    .select("id, name, created_at")
    .single();

  if (error || !data) return fail(describeError(error, "Nao foi possivel gerar a chave."));

  return ok({ key, id: data.id, name: data.name, createdAt: data.created_at });
}
