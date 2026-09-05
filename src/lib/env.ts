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

/**
 * Chave secreta da Stripe. `null` = pagamento online desligado, e todo mundo
 * que chama precisa tratar isso — mesmo contrato do `cronSecret()`.
 *
 * Proposital que a chave e o segredo do webhook sejam duas funcoes separadas:
 * o Checkout nao pode quebrar porque falta o segredo do webhook, e o webhook
 * nao pode aceitar trafego so porque a chave de API existe.
 */
export function stripeSecretKey(): string | null {
  const value = process.env.STRIPE_SECRET_KEY;
  return value && value.trim() !== "" ? value : null;
}

/** Segredo que assina os webhooks da Stripe. Sem ele o endpoint recusa tudo. */
export function stripeWebhookSecret(): string | null {
  const value = process.env.STRIPE_WEBHOOK_SECRET;
  return value && value.trim() !== "" ? value : null;
}

/**
 * Origem publica do app. A Stripe exige URL absoluta nos retornos do cadastro
 * e do Checkout, e nao existe `request` na hora de montar essas URLs dentro de
 * uma server action.
 */
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && explicit.trim() !== "") return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel && vercel.trim() !== "") return `https://${vercel}`;

  return "http://localhost:3000";
}

/**
 * Credenciais OAuth do Google Calendar. `null` = reunioes por Meet desligadas,
 * mesmo contrato do `stripeSecretKey()`. O redirect URI e fixo (nao vem de
 * `appBaseUrl()` calculado na hora) porque o Google exige que ele esteja
 * cadastrado nas credenciais do projeto — precisa ser sempre o mesmo valor.
 */
export function googleOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId?.trim() || !clientSecret?.trim()) return null;

  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${appBaseUrl()}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
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
