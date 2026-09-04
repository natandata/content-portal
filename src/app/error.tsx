"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LOCALE_COOKIE, pickLocale, type Locale } from "@/lib/i18n/locale";

/**
 * Error boundary do App Router: so pode ser Client Component, entao nao tem
 * `cookies()` do servidor -- le o cookie de idioma direto do navegador. So
 * roda apos montar (o servidor nao teria como saber o idioma de um erro que
 * so acontece no cliente), entao nasce em pt-BR e corrige no primeiro render.
 */
function readLocale(): Locale {
  if (typeof document === "undefined") return "pt-BR";
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return match?.[1] === "en" ? "en" : "pt-BR";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>("pt-BR");

  useEffect(() => {
    console.error(error);
    setLocale(readLocale());
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <h1 className="text-xl font-semibold text-ink-900">{pickLocale(locale, "Algo deu errado", "Something went wrong")}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        {error.message || pickLocale(locale, "Nao foi possivel carregar esta pagina.", "This page could not be loaded.")}
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>{pickLocale(locale, "Tentar novamente", "Try again")}</Button>
      </div>
    </main>
  );
}
