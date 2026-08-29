import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requirePublicEnv, requireServiceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

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

/**
 * Cliente com service role. Ignora RLS — use apenas em operacoes administrativas
 * no servidor (criacao de usuarios, login por codigo, seed).
 */
export function createAdminClient() {
  const { supabaseUrl } = requirePublicEnv();

  return createServerClient<Database>(supabaseUrl, requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Sem sessao: este cliente nunca escreve cookies.
      },
    },
  });
}
