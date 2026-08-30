"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { THEME_STORAGE_KEY, resolveTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

function apply(preference: ThemePreference) {
  document.documentElement.setAttribute("data-theme", resolveTheme(preference));
}

/**
 * Claro / Escuro / Sistema. O valor mora no localStorage do aparelho: e uma
 * preferencia de dispositivo, nao de conta.
 *
 * So recebe `locale` (string), nunca o dicionario inteiro: o dicionario tem
 * campos com funcao (para textos com variavel), e Server Component nao pode
 * passar funcao como prop para Client Component — o RSC nao serializa isso.
 * Cada Client Component busca o proprio dicionario com `getDictionary`.
 */
export function ThemeToggle({
  compact = false,
  locale = DEFAULT_LOCALE,
}: {
  compact?: boolean;
  locale?: Locale;
}) {
  const dict = getDictionary(locale).settings;
  const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: dict.light, icon: Sun },
    { value: "dark", label: dict.dark, icon: Moon },
    { value: "system", label: dict.system, icon: Monitor },
  ];

  // Comeca em null para nao renderizar o estado errado antes de hidratar.
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    setPreference(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  // Em "sistema", seguir o aparelho em tempo real.
  useEffect(() => {
    if (preference !== "system") return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  function choose(value: ThemePreference) {
    setPreference(value);
    try {
      if (value === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Modo privado pode bloquear: o tema ainda vale para esta sessao.
    }
    apply(value);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema do aplicativo"
      className={cn(
        "grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1",
        compact ? "w-full" : "max-w-xs",
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.label}
            onClick={() => choose(option.value)}
            className={cn(
              "focus-ring flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition",
              active
                ? "bg-surface text-ink-900 shadow-sm"
                : "text-ink-500 hover:text-ink-800",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {compact ? null : option.label}
          </button>
        );
      })}
    </div>
  );
}
