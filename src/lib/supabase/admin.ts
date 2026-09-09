import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requirePublicEnv, requireServiceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client admin (service-role) sem NENHUMA dependencia do Next.js -- extraido
 * de `supabase/server.ts` pra poder ser importado com seguranca por scripts
 * standalone (workers do Railway), que rodam fora do build/runtime do Next e
 * nao tem acesso a `next/headers`. Usa `@supabase/supabase-js` puro em vez
 * de `@supabase/ssr` porque service role nunca precisa de cookies.
 */
export function createAdminClient() {
  const { supabaseUrl } = requirePublicEnv();

  return createSupabaseClient<Database>(supabaseUrl, requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
