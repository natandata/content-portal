import type { PostgrestError } from "@supabase/supabase-js";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function done(): ActionResult<null> {
  return { ok: true, data: null };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

const FRIENDLY_CODES: Record<string, string> = {
  "23505": "Ja existe um registro com esses dados.",
  "23503": "Registro relacionado nao encontrado.",
  "42501": "Voce nao tem permissao para esta operacao.",
};

/** Converte um erro do Postgrest em uma mensagem util para o usuario. */
export function describeError(
  error: PostgrestError | Error | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;

  if ("code" in error && typeof error.code === "string") {
    const friendly = FRIENDLY_CODES[error.code];
    if (friendly) return friendly;
  }

  const message = error.message?.trim();
  if (!message) return fallback;

  // Mensagens de RAISE EXCEPTION do Postgres sao escritas para o usuario final.
  if (message.length < 200) return message;
  return fallback;
}

/** Primeira mensagem de erro de um ZodError achatado. */
export function firstIssue(issues: { message: string }[], fallback: string): string {
  return issues[0]?.message ?? fallback;
}
