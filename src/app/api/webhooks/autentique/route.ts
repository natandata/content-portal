import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { autentiqueConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { completeIfSigned } from "@/server/autentique/reconcile";

/**
 * Webhook GLOBAL do Autentique (uma URL so pra conta inteira, configurada no
 * painel deles -- nao existe callback por documento na API real, confirmado
 * contra a documentacao publica em 2026-09-08). Autenticacao via
 * `x-autentique-signature` (HMAC-SHA256 do corpo cru com o segredo emitido
 * pelo Autentique ao registrar o endpoint).
 *
 * ASSUMPTION -- a documentacao publica confirma que o header existe e que e'
 * HMAC-SHA256, mas nao documenta a codificacao exata (hex vs base64) nem se
 * ha prefixo tipo "sha256=". Implementado aqui como hex simples (convencao
 * mais comum) -- ajustar `verifySignature` se a primeira entrega real
 * (roteiro de verificacao) mostrar um formato diferente. Mesmo se a
 * verificacao nunca ficar 100% certa, o cron de reconciliamento
 * (`api/cron/autentique-reconcile`) e' a rede de seguranca real -- este
 * webhook e' so o caminho rapido.
 *
 * Payload confirmado: `{ event: { id, type, data: { object: { id } } } }`.
 * `type` inclui `document.finished` (todos assinaram) entre outros -- so
 * esse dispara `completeIfSigned`; o resto so e reconhecido (200) sem acao,
 * pra o Autentique nao ficar reentregando.
 */
export const runtime = "nodejs";

interface AutentiqueWebhookBody {
  event: {
    id: string;
    type: string;
    data: { object?: { id?: string } };
  };
}

function verifySignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  let signatureBuffer: Buffer;
  try {
    signatureBuffer = Buffer.from(signatureHeader, "hex");
  } catch {
    return false;
  }
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: Request) {
  const config = autentiqueConfig();
  // `webhookSecret` e' opcional (recurso Pro na conta Autentique) -- sem
  // ele este endpoint fica desligado, e o app depende so do cron diario de
  // reconciliamento pra fechar os documentos assinados.
  if (!config || !config.webhookSecret) {
    return NextResponse.json({ error: "Webhook do Autentique nao configurado" }, { status: 404 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-autentique-signature");
  if (!signatureHeader || !verifySignature(rawBody, signatureHeader, config.webhookSecret)) {
    return NextResponse.json({ error: "Assinatura invalida" }, { status: 401 });
  }

  let body: AutentiqueWebhookBody;
  try {
    body = JSON.parse(rawBody) as AutentiqueWebhookBody;
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }

  const eventId = body.event?.id;
  const eventType = body.event?.type;
  const documentId = body.event?.data?.object?.id;
  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Payload sem id/type do evento" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: claimError } = await admin
    .from("autentique_webhook_events")
    .insert({ id: eventId, event_type: eventType });
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  try {
    if (eventType === "document.finished" && documentId) {
      const { data: contract } = await admin
        .from("contracts")
        .select("id, client_id, title, autentique_document_id")
        .eq("autentique_document_id", documentId)
        .eq("status", "sent_for_signature")
        .maybeSingle();

      if (contract) {
        await completeIfSigned(admin, contract);
      }
    }
    // Outros tipos de evento (signature.viewed, signature.rejected, etc.)
    // so sao reconhecidos por enquanto -- nada pra atualizar no v1.
  } catch (error) {
    // Solta a reserva -- mesma razao do webhook da Calendly: sem isso um
    // retry do Autentique bateria na unique e o evento se perderia.
    await admin.from("autentique_webhook_events").delete().eq("id", eventId);
    const message = error instanceof Error ? error.message : "Falha ao processar o evento";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await admin
    .from("autentique_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", eventId);

  return NextResponse.json({ received: true });
}
