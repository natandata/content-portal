"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requirePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente Supabase do browser — usa apenas a anon key e a sessao do usuario. */
export function createClient() {
  if (cached) return cached;
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();
  cached = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return cached;
}
