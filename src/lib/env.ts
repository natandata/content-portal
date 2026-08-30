/** Leitura centralizada das variaveis de ambiente, com mensagens uteis. */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Variavel de ambiente ausente: ${name}. Preencha o .env.local (veja .env.example).`,
    );
  }
  return value;
}

/** Disponiveis no browser. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

export function requirePublicEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", publicEnv.supabaseUrl),
    supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", publicEnv.supabaseAnonKey),
  };
}

/** Somente server-side. Nunca importar em componentes de cliente. */
export function requireServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function adminEmail(): string {
  return (process.env.ADMIN_EMAIL ?? "admin@contentportal.local").toLowerCase();
}

/**
 * Segredo que a Vercel manda automaticamente (`Authorization: Bearer ...`) ao
 * chamar um Cron Job, quando a variavel CRON_SECRET existe no projeto. Sem a
 * variavel configurada, o endpoint de cron recusa toda chamada — falha
 * fechado de proposito, nunca aberto.
 */
export function cronSecret(): string | null {
  const value = process.env.CRON_SECRET;
  return value && value.trim() !== "" ? value : null;
}

export const isSupabaseConfigured =
  publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseAnonKey.length > 0;

/** Chaves do Web Push. So o servidor le a privada; a publica tambem vai ao browser. */
export function vapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = publicEnv.vapidPublicKey;
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "";
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
