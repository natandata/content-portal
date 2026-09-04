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

/**
 * Escolhe a string certa pro idioma — para mensagens curtas de servidor
 * (erros de acao, toasts) que nao justificam uma entrada no dicionario
 * grande de `dictionary.ts` (esse e para arvore de componentes). Usado
 * direto nas server actions que o cliente pode disparar.
 */
export function pickLocale(locale: Locale, pt: string, en: string): string {
  return locale === "en" ? en : pt;
}
