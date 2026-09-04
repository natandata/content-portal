import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { isSupabaseConfigured } from "@/lib/env";
import { pickLocale } from "@/lib/i18n/locale";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerDictionary();
  return { title: pickLocale(locale, "Acesso", "Sign in") };
}

export default async function LoginPage() {
  const { locale, dict } = await getServerDictionary();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid size-11 grid-cols-2 gap-[3px] rounded-xl bg-ink-900 p-[7px]">
            <span className="rounded-[3px] bg-on-ink" />
            <span className="rounded-[3px] bg-on-ink/55" />
            <span className="rounded-[3px] bg-on-ink/55" />
            <span className="rounded-[3px] bg-on-ink" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">{dict.login.title}</h1>
          <p className="mt-1.5 text-sm text-ink-500">{dict.login.subtitle}</p>
        </div>

        <div className="mb-4">
          <LanguageToggle locale={locale} />
        </div>

        {isSupabaseConfigured ? (
          <LoginForm locale={locale} />
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

        <p className="mt-6 text-center text-xs text-ink-400">{dict.login.footer}</p>
      </div>
    </main>
  );
}
