import "server-only";

import { cookies } from "next/headers";

import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/locale";

/** Le o idioma escolhido no cookie. Sem cookie (primeira visita), pt-BR. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getServerDictionary(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
