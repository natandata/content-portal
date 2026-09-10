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

/**
 * Credenciais OAuth do Calendly. `null` = reunioes por Calendly desligadas,
 * mesmo contrato de `googleOAuthConfig()`. A API da Calendly e REST simples
 * (sem SDK) — este modulo so guarda as tres variaveis, quem monta a URL e
 * troca o code por token e `src/lib/calendly/client.ts`.
 */
export function calendlyOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.CALENDLY_CLIENT_ID;
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET;
  if (!clientId?.trim() || !clientSecret?.trim()) return null;

  const redirectUri = process.env.CALENDLY_REDIRECT_URI?.trim() || `${appBaseUrl()}/api/auth/calendly/callback`;
  return { clientId, clientSecret, redirectUri };
}

/**
 * Credenciais da Apify (relatorio de perfil publico do Instagram, sem
 * login). `null` = relatorio desligado, mesmo contrato das outras
 * integracoes. O `webhookSecret` e gerado por nos (nao a Apify manda) —
 * colado na URL do webhook na hora de disparar cada run, para o endpoint
 * saber que quem chamou de volta foi mesmo a Apify.
 */
export function apifyConfig(): { apiToken: string; webhookSecret: string } | null {
  const apiToken = process.env.APIFY_API_TOKEN;
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;
  if (!apiToken?.trim() || !webhookSecret?.trim()) return null;
  return { apiToken, webhookSecret };
}

/**
 * Chave de API da Composio (insights do Instagram via OAuth do cliente —
 * nunca senha). `null` = relatorio de insights desligado, mesmo contrato
 * das outras integracoes. `instagramAuthConfigId` e o "Auth Config" criado
 * uma vez no painel da Composio (representa o app Meta for Developers
 * cadastrado la) — a Composio exige esse id toda vez que inicia uma conexao
 * nova, nao tem como inferir na hora.
 */
export function composioConfig(): { apiKey: string; instagramAuthConfigId: string } | null {
  const apiKey = process.env.COMPOSIO_API_KEY;
  const instagramAuthConfigId = process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID;
  if (!apiKey?.trim() || !instagramAuthConfigId?.trim()) return null;
  return { apiKey, instagramAuthConfigId };
}

/**
 * Token da API do Autentique (assinatura eletronica, terceira opcao ao lado
 * do upload manual e do link do Gov.br). `null` = assinatura via Autentique
 * desligada, mesmo contrato das outras integracoes -- o upload manual e o
 * Gov.br continuam funcionando normalmente.
 *
 * `webhookSecret` e' OPCIONAL de proposito: a autenticacao assinada
 * (HMAC-SHA256 no header `x-autentique-signature`) e' recurso Pro da conta
 * Autentique (confirmado ao vivo em 2026-09-08 -- bloqueado no plano
 * Gratis). Sem esse segredo, `api/webhooks/autentique` fica desligado
 * (404) e o app depende so do cron diario de reconciliamento
 * (`api/cron/autentique-reconcile`) pra fechar os documentos assinados --
 * mais lento (ate 24h), mas gratis e continua funcionando por completo.
 */
export function autentiqueConfig(): { apiKey: string; webhookSecret: string | null } | null {
  const apiKey = process.env.AUTENTIQUE_API_KEY;
  if (!apiKey?.trim()) return null;
  const webhookSecret = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  return { apiKey, webhookSecret: webhookSecret?.trim() ? webhookSecret : null };
}

/**
 * Auth Config id de cada rede social alem do Instagram, criado a mao no
 * painel da Composio (mesmo pre-requisito manual do Instagram, uma vez por
 * rede). `null` = aquela rede ainda nao foi configurada nesta instalacao.
 */
export function socialAuthConfigId(
  platform: "tiktok" | "linkedin" | "facebook" | "pinterest" | "youtube",
): string | null {
  const envName = {
    tiktok: "COMPOSIO_TIKTOK_AUTH_CONFIG_ID",
    linkedin: "COMPOSIO_LINKEDIN_AUTH_CONFIG_ID",
    facebook: "COMPOSIO_FACEBOOK_AUTH_CONFIG_ID",
    pinterest: "COMPOSIO_PINTEREST_AUTH_CONFIG_ID",
    youtube: "COMPOSIO_YOUTUBE_AUTH_CONFIG_ID",
  }[platform];
  const value = process.env[envName];
  return value?.trim() ? value : null;
}

/**
 * Credenciais do Mercado Pago (Pix/boleto automatico, alternativa nacional
 * ao Stripe pra quem nao aceita cartao). `null` = pagamento automatico via
 * Mercado Pago desligado -- boleto/Pix manual e Stripe continuam
 * funcionando normalmente. `webhookSecret` e o "Assinatura secreta" gerado
 * no painel de notificacoes do Mercado Pago, usado pra validar o header
 * `x-signature` de cada webhook.
 */
export function mercadoPagoConfig(): { accessToken: string; webhookSecret: string } | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!accessToken?.trim() || !webhookSecret?.trim()) return null;
  return { accessToken, webhookSecret };
}

/**
 * Token da API do Focus NFe (emissao de nota fiscal de servico). `null` =
 * emissao automatica desligada -- cobranca continua funcionando sem nota.
 * `sandbox: true` aponta pro ambiente de homologacao do Focus NFe (nunca
 * emite nota valida) -- fica ligado por padrao, so vira producao com a env
 * var explicita, pra nunca emitir nota de verdade sem essa decisao clara.
 */
export function focusNfeConfig(): { apiToken: string; sandbox: boolean } | null {
  const apiToken = process.env.FOCUS_NFE_API_TOKEN;
  if (!apiToken?.trim()) return null;
  return { apiToken, sandbox: process.env.FOCUS_NFE_ENV !== "production" };
}

/**
 * Credenciais da Twilio (notificacao via WhatsApp Business API). `null` =
 * WhatsApp desligado -- push notification continua sendo o canal principal.
 * `whatsappFrom` e o numero do WhatsApp Sender aprovado pela Meta, no
 * formato `whatsapp:+55...` que a Twilio exige.
 */
export function twilioConfig(): { accountSid: string; authToken: string; whatsappFrom: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid?.trim() || !authToken?.trim() || !whatsappFrom?.trim()) return null;
  return { accountSid, authToken, whatsappFrom };
}

/** Chave da API da Anthropic (geracao de legenda/roteiro assistida por IA). `null` = geracao desligada. */
export function anthropicConfig(): { apiKey: string } | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) return null;
  return { apiKey };
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
