"use client";

import { useRouter } from "next/navigation";

import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "pt-BR", label: "Sou Brasileiro" },
  { value: "en", label: "I'm not Brazilian" },
];

/**
 * Idioma completo do app — nao so um texto, todo o conteudo renderizado no
 * servidor muda. Fica num cookie (nao localStorage) porque quem le "pt-BR" ou
 * "en" e o proprio servidor, antes de mandar o HTML: sem isso a pagina
 * nasceria no idioma errado e trocaria na tela depois de carregar.
 *
 * O padrao e portugues — a maioria dos clientes e brasileira. Cookie de 1 ano
 * porque e uma escolha estavel, do tipo que a pessoa faz uma vez.
 */
export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter();

  function choose(value: Locale) {
    if (value === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }

  return (
    <div role="radiogroup" aria-label="Idioma / Language" className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={locale === option.value}
          onClick={() => choose(option.value)}
          className={cn(
            "focus-ring rounded-lg py-2 text-xs font-medium transition sm:text-sm",
            locale === option.value
              ? "bg-surface text-ink-900 shadow-sm"
              : "text-ink-500 hover:text-ink-800",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
