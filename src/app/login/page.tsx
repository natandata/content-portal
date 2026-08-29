import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Acesso" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid size-11 grid-cols-2 gap-[3px] rounded-xl bg-ink-900 p-[7px]">
            <span className="rounded-[3px] bg-white" />
            <span className="rounded-[3px] bg-white/55" />
            <span className="rounded-[3px] bg-white/55" />
            <span className="rounded-[3px] bg-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">Content Portal</h1>
          <p className="mt-1.5 text-sm text-ink-500">Acesse sua conta</p>
        </div>

        {isSupabaseConfigured ? (
          <LoginForm />
        ) : (
          <div className="card p-5 text-sm text-ink-600">
            <h2 className="mb-2 text-sm font-semibold text-ink-900">Configuracao pendente</h2>
            <p className="mb-3">
              Defina <code className="rounded bg-ink-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
              <code className="rounded bg-ink-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no
              arquivo <code className="rounded bg-ink-100 px-1">.env.local</code> e reinicie o
              servidor.
            </p>
            <p className="text-ink-500">O passo a passo completo esta no README.md.</p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-ink-400">
          Plataforma privada. O acesso e individual e monitorado.
        </p>
      </div>
    </main>
  );
}
