"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { issueApiKey } from "@/server/mcp/issue-key";
import { describeError, done, fail, ok, type ActionResult } from "@/server/result";

/**
 * Chaves de API do assistente MCP (Claude) -- ver `src/app/api/mcp/route.ts`.
 * A chave em si (`sk_live_...`) so existe uma vez, na resposta desta acao; o
 * banco guarda so o hash SHA-256 (emissao real em
 * `src/server/mcp/issue-key.ts`, compartilhada com o fluxo de OAuth do
 * conector do claude.ai/app). Sempre pertence ao proprio ator -- nao existe
 * "gerar para outro profissional" por aqui, cada um gera a sua.
 */

function revalidate() {
  revalidatePath("/admin/settings");
  revalidatePath("/professional/settings");
}

const createSchema = z.object({
  name: z.string().trim().min(2, "De um nome pra chave (ex.: Claude).").max(60),
});

export interface ApiKeyStatus {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function createApiKeyAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ key: string; row: ApiKeyStatus }>> {
  const actor = await requireStaff();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados invalidos.");

  const issued = await issueApiKey(actor.authUser.id, parsed.data.name);
  if (!issued.ok) return issued;

  revalidate();
  return ok({
    key: issued.data.key,
    row: { id: issued.data.id, name: issued.data.name, createdAt: issued.data.createdAt, lastUsedAt: null },
  });
}

export async function listApiKeysAction(): Promise<ActionResult<ApiKeyStatus[]>> {
  const actor = await requireStaff();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("professional_api_keys")
    .select("id, name, created_at, last_used_at")
    .eq("professional_id", actor.authUser.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return fail(describeError(error, "Nao foi possivel carregar as chaves."));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    })),
  );
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult<null>> {
  const actor = await requireStaff();
  const admin = createAdminClient();

  const { error } = await admin
    .from("professional_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("professional_id", actor.authUser.id);

  if (error) return fail(describeError(error, "Nao foi possivel revogar a chave."));

  revalidate();
  return done();
}
