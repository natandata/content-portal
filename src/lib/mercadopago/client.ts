import "server-only";

import { randomUUID } from "node:crypto";
import { createHmac, timingSafeEqual } from "node:crypto";

import { mercadoPagoOAuthConfig } from "@/lib/env";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const API_BASE = "https://api.mercadopago.com";

/**
 * OAuth2 puro via `fetch` -- mesmo desenho de `lib/calendly/client.ts`. Cada
 * profissional conecta a PROPRIA conta (marketplace): o Access Token
 * devolvido aqui e o que autentica a criacao do Pix em nome dele, nunca um
 * token unico da agencia.
 */
export function mercadoPagoAuthUrl(state: string): string | null {
  const config = mercadoPagoOAuthConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: config.redirectUri,
    state,
  });

  return `https://auth.mercadopago.com/authorization?${params.toString()}`;
}

export interface MercadoPagoTokens {
  accessToken: string;
  refreshToken: string;
  userId: number;
  publicKey: string | null;
  liveMode: boolean;
  /** Epoch ms -- calculado a partir do `expires_in` (segundos) que o Mercado Pago devolve. */
  expiresAt: number;
}

async function requestToken(body: Record<string, string>): Promise<MercadoPagoTokens | null> {
  const config = mercadoPagoOAuthConfig();
  if (!config) return null;

  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, ...body }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    user_id: number;
    public_key?: string;
    live_mode: boolean;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: data.user_id,
    publicKey: data.public_key ?? null,
    liveMode: data.live_mode,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/** Troca o `code` do redirect pelo primeiro par de tokens. */
export function exchangeMercadoPagoCode(code: string): Promise<MercadoPagoTokens | null> {
  const config = mercadoPagoOAuthConfig();
  if (!config) return Promise.resolve(null);

  return requestToken({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri });
}

/** Renova o access_token quando ele esta perto de vencer (dura 180 dias). */
export function refreshMercadoPagoTokens(refreshToken: string): Promise<MercadoPagoTokens | null> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/**
 * Cliente REST cru do Mercado Pago (sem SDK -- mesmo padrao de
 * `lib/autentique/client.ts`/`lib/calendly/api.ts`, API estavel e bem
 * documentada o bastante pra nao precisar de wrapper de terceiro).
 */
async function request<T>(
  accessToken: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Result<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(method === "POST" ? { "X-Idempotency-Key": randomUUID() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = (json?.message as string) ?? `Mercado Pago respondeu ${response.status}.`;
      return { ok: false, error: message };
    }
    return { ok: true, data: json as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao falar com o Mercado Pago." };
  }
}

export interface MercadoPagoPixPayment {
  id: number;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
}

/**
 * Cria uma cobranca Pix. CPF e obrigatorio pela API do Mercado Pago mesmo
 * pra pessoa fisica pagando -- por isso `payer_cpf`/`payer_name` viraram
 * campos novos na cobranca (ver migracao `invoice_mercadopago_nfe_columns`).
 */
export async function createPixPayment(
  accessToken: string,
  params: {
    invoiceId: string;
    amount: number;
    description: string;
    payerEmail: string;
    payerName: string;
    payerCpf: string;
    /**
     * Comissao da plataforma retida na hora (marketplace split) -- o
     * Access Token usado aqui e o do PROFISSIONAL conectado, entao o
     * restante ja cai direto na conta dele. `undefined`/0 = sem comissao.
     */
    applicationFee?: number;
  },
): Promise<Result<MercadoPagoPixPayment>> {
  const [firstName, ...rest] = params.payerName.trim().split(/\s+/);
  const result = await request<{
    id: number;
    status: string;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
  }>(accessToken, "POST", "/v1/payments", {
    transaction_amount: params.amount,
    description: params.description,
    payment_method_id: "pix",
    external_reference: params.invoiceId,
    ...(params.applicationFee ? { application_fee: params.applicationFee } : {}),
    payer: {
      email: params.payerEmail,
      first_name: firstName || params.payerName,
      last_name: rest.join(" ") || undefined,
      identification: { type: "CPF", number: params.payerCpf.replace(/\D/g, "") },
    },
  });
  if (!result.ok) return result;

  const txData = result.data.point_of_interaction?.transaction_data;
  return {
    ok: true,
    data: {
      id: result.data.id,
      status: result.data.status,
      qrCode: txData?.qr_code ?? null,
      qrCodeBase64: txData?.qr_code_base64 ?? null,
    },
  };
}

/** Consulta o status atual de um pagamento -- usado pelo webhook (que so manda o id) e pelo cron de reconciliamento. */
export async function getPayment(
  accessToken: string,
  paymentId: string,
): Promise<Result<{ id: number; status: string; externalReference: string | null }>> {
  const result = await request<{ id: number; status: string; external_reference?: string }>(
    accessToken,
    "GET",
    `/v1/payments/${paymentId}`,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: { id: result.data.id, status: result.data.status, externalReference: result.data.external_reference ?? null },
  };
}

/**
 * Valida a assinatura `x-signature` do webhook (formato `ts=...,v1=...`),
 * conforme documentado pelo Mercado Pago: HMAC-SHA256 do manifest
 * `id:{dataId};request-id:{requestId};ts:{ts};` usando o segredo do
 * webhook, comparado ao `v1` recebido.
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string;
  requestId: string;
  dataId: string;
  webhookSecret: string;
}): boolean {
  const parts = Object.fromEntries(
    params.signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=").map((s) => s.trim());
      return [key, value];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${ts};`;
  const expected = createHmac("sha256", params.webhookSecret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(v1, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
