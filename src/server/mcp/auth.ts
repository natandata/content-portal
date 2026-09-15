import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { fail, done, type ActionResult } from "@/server/result";
import type { UserRole } from "@/types/database";

export interface McpActor {
  userId: string;
  role: UserRole;
  displayName: string;
  email: string;
}

/**
 * Resolve o dono de uma chave de API do assistente MCP a partir do header
 * Authorization (`Bearer <chave>`) -- sem cookie de sessao, o MCP roda fora
 * do navegador. A chave nunca e guardada em texto puro, so o hash SHA-256
 * (ver `src/server/actions/api-keys.ts`). Admin enxerga todos os clientes
 * (mesma regra de `requireStaff()` hoje); profissional so os proprios
 * (`clients.professional_id = userId`) -- ver `assertClientOwnership`.
 */
export async function resolveMcpActor(authorizationHeader: string | null): Promise<McpActor | null> {
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;

  const admin = createAdminClient();
  const keyHash = createHash("sha256").update(token).digest("hex");

  const { data: key } = await admin
    .from("professional_api_keys")
    .select("id, professional_id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!key) return null;

  const { data: user } = await admin
    .from("users")
    .select("id, name, role, email, status")
    .eq("id", key.professional_id)
    .maybeSingle();
  if (!user || user.status !== "active") return null;

  // Melhor esforco -- nao bloqueia a ferramenta por causa disso.
  await admin
    .from("professional_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(
      () => {},
      () => {},
    );

  return { userId: user.id, role: user.role, displayName: user.name, email: user.email };
}

/** Confere que o cliente existe e pertence ao ator (admin sempre pode; profissional so os proprios). */
export async function assertClientOwnership(
  admin: ReturnType<typeof createAdminClient>,
  actor: McpActor,
  clientId: string,
): Promise<ActionResult<null>> {
  const { data } = await admin.from("clients").select("id, professional_id").eq("id", clientId).maybeSingle();
  if (!data) return fail("Cliente nao encontrado.");
  if (actor.role !== "admin" && data.professional_id !== actor.userId) return fail("Cliente nao encontrado.");
  return done();
}

/** Limite pratico pra arquivo enviado como argumento de ferramenta (base64 no corpo JSON). */
export const MCP_MAX_FILE_BYTES = 20 * 1024 * 1024;
