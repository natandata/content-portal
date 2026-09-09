import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requirePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client admin (service-role) mora em `./admin` -- sem NENHUMA dependencia
 * do Next.js, pra poder ser importado por scripts standalone (workers do
 * Railway). Reexportado aqui pra todo `import { createAdminClient } from
 * "@/lib/supabase/server"` existente continuar funcionando sem mudanca.
 */
export { createAdminClient } from "./admin";

/**
 * Cliente para Server Components, Server Actions e Route Handlers.
 * Respeita a sessao do usuario e, portanto, todas as policies de RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components nao podem escrever cookies; o middleware renova a sessao.
        }
      },
    },
  });
}
