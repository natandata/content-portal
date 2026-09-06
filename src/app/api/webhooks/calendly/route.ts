import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Webhook da Calendly.
 *
 * Mesmo desenho do webhook da Stripe (`app/api/webhooks/stripe/route.ts`):
 * le o corpo cru (a assinatura e sobre os bytes exatos), reserva o evento
 * antes de processar e libera a reserva se o processamento falhar, para a
 * Calendly poder reentregar sem virar duplicata perdida.
 *
 * Diferenca de assinatura: a Calendly nao tem um segredo unico por
 * instalacao como a Stripe — cada profissional tem a propria
 * `webhook_signing_key`, gerada quando a assinatura foi criada no callback
 * OAuth (`api/auth/calendly/callback`). Por isso o organizador precisa ser
 * identificado a partir do corpo (nao confiavel ainda) antes de saber com
 * qual chave verificar — mesma ordem que a Calendly documenta.
 *
 * Formato do header confirmado na documentacao (nao observado em uma
 * entrega real nesta instalacao): `Calendly-Webhook-Signature:
 * t=<timestamp>,v1=<hmac-sha256 hex de "timestamp.corpo">`.
 *
 * Formato do payload (`payload.scheduled_event`, `payload.email`, etc.)
 * baseado no formato documentado da Calendly e no formato observado via
 * REST (GET /scheduled_events, GET .../invitees) para os mesmos recursos —
 * NAO observado como entrega de webhook real ainda. Ajustar campos aqui se
 * o primeiro teste de agendamento de verdade (roteiro de verificacao,
 * etapa 4) mostrar um formato diferente.
 */
export const runtime = "nodejs";

const TIMESTAMP_TOLERANCE_MS = 5 * 60_000;

interface CalendlyLocation {
  join_url?: string;
}

interface CalendlyScheduledEvent {
  uri: string;
  start_time: string;
  end_time: string;
  location?: CalendlyLocation;
  event_memberships?: { user: string }[];
}

interface CalendlyInviteePayload {
  uri: string;
  email: string;
  name?: string | null;
  event: string; // uri do scheduled_event
  scheduled_event?: CalendlyScheduledEvent;
  cancellation?: { canceled_by?: string; reason?: string | null } | null;
}

interface CalendlyWebhookBody {
  event: "invitee.created" | "invitee.canceled" | string;
  created_at: string;
  payload: CalendlyInviteePayload;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("calendly-webhook-signature");
  if (!signatureHeader) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  let body: CalendlyWebhookBody;
  try {
    body = JSON.parse(rawBody) as CalendlyWebhookBody;
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }

  const organizerUri = body.payload?.scheduled_event?.event_memberships?.[0]?.user;
  if (!organizerUri) {
    return NextResponse.json({ error: "Payload sem organizador" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("professional_calendly_accounts")
    .select("user_id, webhook_signing_key")
    .eq("calendly_uri", organizerUri)
    .maybeSingle();

  if (!account?.webhook_signing_key) {
    // Nao conhecemos esse organizador (ou a assinatura de webhook nao foi
    // criada) — nao ha como verificar, entao nao ha como confiar.
    return NextResponse.json({ error: "Organizador desconhecido" }, { status: 401 });
  }

  if (!verifySignature(rawBody, signatureHeader, account.webhook_signing_key)) {
    return NextResponse.json({ error: "Assinatura invalida" }, { status: 401 });
  }

  const eventId = `${body.payload.uri}:${body.event}`;

  const { error: claimError } = await admin
    .from("calendly_webhook_events")
    .insert({ id: eventId, event_type: body.event });

  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  try {
    await handleEvent(body, account.user_id, admin);
  } catch (error) {
    // Solta a reserva antes de devolver erro, mesma razao do webhook da
    // Stripe: sem isso o retry da Calendly bateria na unique e o evento se
    // perderia para sempre.
    await admin.from("calendly_webhook_events").delete().eq("id", eventId);
    const message = error instanceof Error ? error.message : "Falha ao processar o evento";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await admin
    .from("calendly_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", eventId);

  return NextResponse.json({ received: true });
}

function verifySignature(rawBody: string, header: string, signingKey: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > TIMESTAMP_TOLERANCE_MS) {
    return false;
  }

  const expected = createHmac("sha256", signingKey).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleEvent(body: CalendlyWebhookBody, professionalId: string, admin: AdminClient) {
  if (body.event === "invitee.created") {
    await onInviteeCreated(body.payload, professionalId, admin);
    return;
  }
  if (body.event === "invitee.canceled") {
    await onInviteeCanceled(body.payload, admin);
    return;
  }
  // Evento que nao tratamos ainda (ex.: reagendamento) — 200 e proposital,
  // devolver erro faria a Calendly reenviar para sempre.
}

/**
 * Acha o pedido pendente que gerou o link de uso unico que a pessoa acabou
 * de preencher. A correlacao e por e-mail de contato porque o link nao
 * carrega o id do pedido de volta — mesma limitacao que o resto do fluxo Calendly
 * ja aceita (ver plano, "regras que nao podem ser violadas").
 */
async function onInviteeCreated(
  invitee: CalendlyInviteePayload,
  professionalId: string,
  admin: AdminClient,
) {
  const scheduledEvent = invitee.scheduled_event;
  if (!scheduledEvent) throw new Error("Payload sem scheduled_event");

  const { data: meeting } = await admin
    .from("meeting_requests")
    .select("id")
    .eq("professional_id", professionalId)
    .eq("method", "calendly")
    .eq("status", "pending")
    .ilike("contact_email", invitee.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!meeting) {
    // Ninguem no portal pediu isso — a pessoa pode ter usado o
    // scheduling_url pessoal do profissional por fora do app. Nao e erro
    // nosso, so nao ha o que atualizar.
    return;
  }

  const { error } = await admin
    .from("meeting_requests")
    .update({
      status: "scheduled",
      calendly_event_uri: scheduledEvent.uri,
      scheduled_start: scheduledEvent.start_time,
      scheduled_end: scheduledEvent.end_time,
      meet_link: scheduledEvent.location?.join_url ?? null,
    })
    .eq("id", meeting.id);

  if (error) throw new Error(error.message);
}

async function onInviteeCanceled(invitee: CalendlyInviteePayload, admin: AdminClient) {
  const eventUri = invitee.scheduled_event?.uri ?? invitee.event;

  const { error } = await admin
    .from("meeting_requests")
    .update({ status: "cancelled" })
    .eq("calendly_event_uri", eventUri)
    .neq("status", "cancelled");

  if (error) throw new Error(error.message);
}
