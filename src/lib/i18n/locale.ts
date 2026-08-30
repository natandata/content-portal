export type Locale = "pt-BR" | "en";

export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_COOKIE = "content-portal-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "pt-BR" || value === "en";
}

/** Locale do Intl.DateTimeFormat correspondente. O fuso continua Brasilia mesmo em ingles — o negocio e daqui. */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "pt-BR";
}
