"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActor, type Actor } from "@/lib/auth";
import { cancelCalendlyEvent, createSingleUseSchedulingLink, findScheduledEventForInvitee } from "@/lib/calendly/api";
import { cancelMeetEvent, createMeetEvent } from "@/lib/google/calendar";
import { sendPushToClient, sendPushToClientStaff } from "@/lib/push";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { loadCalendlyConnectionStatus } from "@/server/actions/calendly-connect";
import { logClientActivity } from "@/server/activity";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { MeetingRequestRow } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

const MEETING_DURATION_MINUTES = 30;

function revalidateMeetings(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
  revalidatePath("/client/meetings");
}

const requestSchema = z.object({
  clientId: z.uuid(),
  contactEmail: z.email("Informe um e-mail valido."),
  // So obrigatorios no metodo google_meet — no metodo calendly a pessoa
  // escolhe o horario livre direto na Calendly, nao aqui.
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da reuniao.").optional(),
  proposedTime: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horario da reuniao.").optional(),
  message: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});

/**
 * Cliente ou equipe pede uma reuniao. Se o profissional tem o Calendly
 * conectado com um tipo de reuniao escolhido, gera um link de uso unico e a
 * pessoa marca um horario que ja esta livre — sem etapa de aprovacao,
 * porque a disponibilidade real e a propria aprovacao (o webhook em
 * `api/webhooks/calendly` confirma quando alguem realmente marca). Sem
 * Calendly conectado, continua o fluxo de sempre: propoe data/hora e a
 * outra parte aprova (`respondMeetingRequestAction`).
 */
export async function requestMeetingAction(
  input: z.input<typeof requestSchema>,
): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues, "Dados invalidos."));

  const { clientId, contactEmail, proposedDate, proposedTime, message } = parsed.data;
  const supabase = await createClient();

  let professionalId: string | null;
  const requestedBy = actor.role === "client" ? "client" : "professional";

  if (actor.role === "client") {
    if (!actor.client || actor.client.id !== clientId) return fail("Sem permissao para este cliente.");
    professionalId = actor.client.professional_id;
  } else {
    // Leitura pela RLS de proposito: se o staff nao gerencia este cliente, a
    // policy simplesmente nao devolve a linha.
    const { data: client } = await supabase
      .from("clients")
      .select("professional_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return fail("Cliente nao encontrado ou sem permissao.");
    professionalId = client.professional_id;
  }

  if (!professionalId) {
    return fail("Este cliente ainda nao tem um profissional responsavel para a reuniao.");
  }

  const calendly = await loadCalendlyConnectionStatus(professionalId);
  const admin = createAdminClient();

  if (calendly.connected && calendly.eventTypeUri) {
    const link = await createSingleUseSchedulingLink(professionalId, calendly.eventTypeUri);
    if (!link.ok) return fail(link.error);

    const bookingUrl = new URL(link.data);
    bookingUrl.searchParams.set("email", contactEmail);

    const { error } = await admin.from("meeting_requests").insert({
      client_id: clientId,
      professional_id: professionalId,
      requested_by: requestedBy,
      method: "calendly",
      contact_email: contactEmail,
      message: message ?? null,
      calendly_booking_url: bookingUrl.toString(),
      created_by: actor.authUser.id,
    });

    if (error) {
      return fail(describeError(error, "Nao foi possivel enviar o pedido de reuniao."));
    }

    if (requestedBy === "client") {
      await sendPushToClientStaff(clientId, {
        title: "Pedido de reuniao",
        body: "O cliente vai escolher um horario livre pelo Calendly.",
        url: `/professional/clients/${clientId}`,
        tag: `meeting-request-${clientId}`,
      }).catch(() => {});
    } else {
      await sendPushToClient(clientId, (locale) => ({
        title: locale === "en" ? "Meeting request" : "Pedido de reuniao",
        body:
          locale === "en"
            ? "Your professional sent a scheduling link — pick a time that works."
            : "Seu profissional enviou um link de agendamento — escolha um horario.",
        url: "/client/meetings",
        tag: `meeting-request-${clientId}`,
      })).catch(() => {});
    }

    await logClientActivity(admin, clientId, actor.displayName, "Pediu uma reuniao");
    revalidateMeetings(clientId);
    return done();
  }

  if (!proposedDate || !proposedTime) {
    return fail("Informe a data e o horario da reuniao.");
  }

  const { error } = await admin.from("meeting_requests").insert({
    client_id: clientId,
    professional_id: professionalId,
    requested_by: requestedBy,
    method: "google_meet",
    contact_email: contactEmail,
    proposed_date: proposedDate,
    proposed_time: proposedTime,
    message: message ?? null,
    created_by: actor.authUser.id,
  });

  if (error) {
    return fail(describeError(error, "Nao foi possivel enviar o pedido de reuniao."));
  }

  if (requestedBy === "client") {
    await sendPushToClientStaff(clientId, {
      title: "Pedido de reuniao",
      body: `O cliente propos uma reuniao para ${proposedDate.split("-").reverse().join("/")} as ${proposedTime}.`,
      url: `/professional/clients/${clientId}`,
      tag: `meeting-request-${clientId}`,
    }).catch(() => {});
  } else {
    await sendPushToClient(clientId, (locale) => ({
      title: locale === "en" ? "Meeting request" : "Pedido de reuniao",
      body:
        locale === "en"
          ? "Your professional proposed a meeting — take a look."
          : "Seu profissional propos uma reuniao — de uma olhada.",
      url: "/client/meetings",
      tag: `meeting-request-${clientId}`,
    })).catch(() => {});
  }

  await logClientActivity(admin, clientId, actor.displayName, "Pediu uma reuniao");
  revalidateMeetings(clientId);
  return done();
}

/**
 * So quem NAO pediu pode aprovar ou recusar — a validacao mora aqui (nao numa
 * policy de RLS) porque depende de comparar `requested_by` com quem esta
 * logado, algo mais simples de acertar em codigo do que em SQL.
 */
export async function respondMeetingRequestAction(
  requestId: string,
  decision: "approved" | "declined",
): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const admin = createAdminClient();
  const { data: meeting } = await admin
    .from("meeting_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!meeting) return fail("Pedido de reuniao nao encontrado.");
  if (meeting.status !== "pending") return fail("Este pedido ja foi respondido.");

  const isClientSide = actor.role === "client" && actor.client?.id === meeting.client_id;

  if (meeting.requested_by === "client" && isClientSide) {
    return fail("Aguarde a equipe responder ao seu pedido.");
  }
  if (meeting.requested_by === "professional" && !isClientSide) {
    return fail("Aguarde o cliente responder ao pedido.");
  }

  if (!isClientSide) {
    // Staff: confirma que realmente gerencia este cliente, pela RLS.
    const supabase = await createClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", meeting.client_id)
      .maybeSingle();
    if (!client) return fail("Sem permissao para este cliente.");
  }

  if (decision === "declined") {
    const { error } = await admin
      .from("meeting_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", meeting.id);
    if (error) return fail(describeError(error, "Nao foi possivel recusar o pedido."));

    await logClientActivity(admin, meeting.client_id, actor.displayName, "Recusou o pedido de reuniao");
    revalidateMeetings(meeting.client_id);
    return done();
  }

  const [{ data: client }, { data: professional }] = await Promise.all([
    admin.from("clients").select("email, company_name").eq("id", meeting.client_id).maybeSingle(),
    admin.from("users").select("email, name").eq("id", meeting.professional_id).maybeSingle(),
  ]);

  if (!professional) return fail("Profissional responsavel nao encontrado.");

  const attendeeEmails = Array.from(
    new Set([meeting.contact_email, professional.email, client?.email].filter((email): email is string => Boolean(email))),
  );

  const start = new Date(`${meeting.proposed_date}T${meeting.proposed_time}:00`);
  const end = new Date(start.getTime() + MEETING_DURATION_MINUTES * 60_000);

  const created = await createMeetEvent(meeting.professional_id, {
    summary: `Reuniao — ${client?.company_name ?? "Cliente"}`,
    description: meeting.message ?? "",
    start,
    end,
    attendeeEmails,
  });

  if (!created.ok) return fail(created.error);

  const { error } = await admin
    .from("meeting_requests")
    .update({
      status: "approved",
      responded_at: new Date().toISOString(),
      google_event_id: created.data.eventId,
      meet_link: created.data.meetLink,
    })
    .eq("id", meeting.id);

  if (error) {
    return fail(describeError(error, "A reuniao foi criada no Google Calendar, mas falhou ao salvar aqui."));
  }

  if (meeting.requested_by === "client") {
    await sendPushToClient(meeting.client_id, (locale) => ({
      title: locale === "en" ? "Meeting confirmed" : "Reuniao confirmada",
      body: locale === "en" ? "Your meeting was approved — check the Google Meet link." : "Sua reuniao foi aprovada — confira o link do Google Meet.",
      url: "/client/meetings",
      tag: `meeting-${meeting.id}`,
    })).catch(() => {});
  } else {
    await sendPushToClientStaff(meeting.client_id, {
      title: "Reuniao confirmada",
      body: "O cliente aprovou a reuniao.",
      url: `/professional/clients/${meeting.client_id}`,
      tag: `meeting-${meeting.id}`,
    }).catch(() => {});
  }

  await logClientActivity(admin, meeting.client_id, actor.displayName, "Aprovou o pedido de reuniao");
  revalidateMeetings(meeting.client_id);
  return done();
}

/** Qualquer um dos dois lados (ou admin) pode cancelar uma reuniao ja marcada. */
export async function cancelMeetingRequestAction(requestId: string): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const admin = createAdminClient();
  const { data: meeting } = await admin
    .from("meeting_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!meeting) return fail("Pedido de reuniao nao encontrado.");

  const isClientSide = actor.role === "client" && actor.client?.id === meeting.client_id;
  if (!isClientSide) {
    const supabase = await createClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", meeting.client_id)
      .maybeSingle();
    if (!client) return fail("Sem permissao para este cliente.");
  }

  if (meeting.google_event_id) {
    await cancelMeetEvent(meeting.professional_id, meeting.google_event_id);
  }
  if (meeting.method === "calendly" && meeting.calendly_event_uri) {
    await cancelCalendlyEvent(meeting.professional_id, meeting.calendly_event_uri, "Cancelado pelo portal.");
  }

  const { error } = await admin
    .from("meeting_requests")
    .update({ status: "cancelled" })
    .eq("id", meeting.id);

  if (error) return fail(describeError(error, "Nao foi possivel cancelar."));

  await logClientActivity(admin, meeting.client_id, actor.displayName, "Cancelou a reuniao");
  revalidateMeetings(meeting.client_id);
  return done();
}

/** So reunioes ja canceladas podem ser apagadas — e so limpeza de historico,
 * nao desfaz nada que ainda esteja em andamento. */
export async function deleteMeetingRequestAction(requestId: string): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const admin = createAdminClient();
  const { data: meeting } = await admin
    .from("meeting_requests")
    .select("id, client_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!meeting) return fail("Pedido de reuniao nao encontrado.");
  if (meeting.status !== "cancelled") return fail("So e possivel apagar reunioes canceladas.");

  const isClientSide = actor.role === "client" && actor.client?.id === meeting.client_id;
  if (!isClientSide) {
    const supabase = await createClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", meeting.client_id)
      .maybeSingle();
    if (!client) return fail("Sem permissao para este cliente.");
  }

  const { error } = await admin.from("meeting_requests").delete().eq("id", meeting.id);
  if (error) return fail(describeError(error, "Nao foi possivel apagar."));

  revalidateMeetings(meeting.client_id);
  return done();
}

/**
 * Confirmacao do lado Calendly — existe porque a assinatura de webhook exige
 * plano pago da Calendly (Standard ou superior); sem isso, a Calendly nunca
 * avisa o app sozinha que a pessoa marcou. Qualquer um dos dois lados pode
 * confirmar — o link de agendamento nao amarra a quem coube marcar.
 */
async function loadMeetingForConfirmation(
  admin: AdminClient,
  requestId: string,
  actor: Actor,
): Promise<{ error: string } | { meeting: MeetingRequestRow; isClientSide: boolean }> {
  const { data: meeting } = await admin
    .from("meeting_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!meeting) return { error: "Pedido de reuniao nao encontrado." };
  if (meeting.method !== "calendly") return { error: "Essa confirmacao e so para reunioes pelo Calendly." };
  if (meeting.status !== "pending") return { error: "Este pedido ja foi atualizado." };

  const isClientSide = actor.role === "client" && actor.client?.id === meeting.client_id;
  if (!isClientSide) {
    const supabase = await createClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", meeting.client_id)
      .maybeSingle();
    if (!client) return { error: "Sem permissao para este cliente." };
  }

  return { meeting, isClientSide };
}

async function applyCalendlyConfirmation(
  admin: AdminClient,
  meeting: MeetingRequestRow,
  isClientSide: boolean,
  fields: { start: Date; end: Date | null; eventUri: string | null; joinUrl: string | null },
): Promise<ActionResult<null>> {
  const { error } = await admin
    .from("meeting_requests")
    .update({
      status: "scheduled",
      scheduled_start: fields.start.toISOString(),
      scheduled_end: fields.end ? fields.end.toISOString() : null,
      calendly_event_uri: fields.eventUri,
      meet_link: fields.joinUrl,
    })
    .eq("id", meeting.id);

  if (error) return fail(describeError(error, "Nao foi possivel confirmar."));

  const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
    fields.start,
  );

  if (isClientSide) {
    await sendPushToClientStaff(meeting.client_id, {
      title: "Reuniao confirmada",
      body: `Marcada para ${dateLabel} pela Calendly.`,
      url: `/professional/clients/${meeting.client_id}`,
      tag: `meeting-${meeting.id}`,
    }).catch(() => {});
  } else {
    await sendPushToClient(meeting.client_id, (locale) => ({
      title: locale === "en" ? "Meeting confirmed" : "Reuniao confirmada",
      body:
        locale === "en"
          ? `Scheduled for ${dateLabel} via Calendly.`
          : `Marcada para ${dateLabel} pela Calendly.`,
      url: "/client/meetings",
      tag: `meeting-${meeting.id}`,
    })).catch(() => {});
  }

  revalidateMeetings(meeting.client_id);
  return done();
}

/**
 * Tentativa automatica, disparada pelo proprio clique em "Ja marquei": busca
 * o evento de verdade na Calendly (por e-mail do convidado, dentro da janela
 * desde que o pedido foi criado) em vez de pedir para alguem digitar a
 * data/hora. `found: false` (ainda `ok: true` — nao e erro, so nao achou
 * ainda) e o sinal para a UI cair no formulario manual como reserva.
 */
export async function autoConfirmCalendlyMeetingAction(
  requestId: string,
): Promise<ActionResult<{ found: boolean }>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const admin = createAdminClient();
  const context = await loadMeetingForConfirmation(admin, requestId, actor);
  if ("error" in context) return fail(context.error);
  const { meeting, isClientSide } = context;

  const { data: account } = await admin
    .from("professional_calendly_accounts")
    .select("calendly_uri")
    .eq("user_id", meeting.professional_id)
    .maybeSingle();

  if (!account) return fail("Profissional sem Calendly conectado.");

  const found = await findScheduledEventForInvitee(
    meeting.professional_id,
    account.calendly_uri,
    meeting.contact_email,
    meeting.created_at,
  );
  if (!found.ok) return fail(found.error);
  if (!found.data) return ok({ found: false });

  const result = await applyCalendlyConfirmation(admin, meeting, isClientSide, {
    start: new Date(found.data.startTime),
    end: new Date(found.data.endTime),
    eventUri: found.data.uri,
    joinUrl: found.data.joinUrl,
  });
  if (!result.ok) return result;
  return ok({ found: true });
}

const confirmCalendlySchema = z.object({
  scheduledStart: z.string().min(1, "Informe a data e o horario marcados."),
});

/** Reserva manual — so aberta quando a busca automatica nao encontrou nada
 * (Calendly ainda nao sincronizou, API fora do ar, etc.). */
export async function confirmCalendlyMeetingAction(
  requestId: string,
  input: z.input<typeof confirmCalendlySchema>,
): Promise<ActionResult<null>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const parsed = confirmCalendlySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues, "Dados invalidos."));

  const admin = createAdminClient();
  const context = await loadMeetingForConfirmation(admin, requestId, actor);
  if ("error" in context) return fail(context.error);
  const { meeting, isClientSide } = context;

  const start = new Date(parsed.data.scheduledStart);
  if (Number.isNaN(start.getTime())) return fail("Data invalida.");

  const { data: account } = await admin
    .from("professional_calendly_accounts")
    .select("calendly_uri, event_type_duration")
    .eq("user_id", meeting.professional_id)
    .maybeSingle();

  const end = account?.event_type_duration
    ? new Date(start.getTime() + account.event_type_duration * 60_000)
    : null;

  // Mesmo confirmando na mao, tenta achar o evento de verdade na Calendly —
  // se conseguir, o link de video (e o horario exato) vem de graca, sem
  // exigir um segundo clique depois. So nao bloqueia: se a Calendly ainda
  // nao tiver sincronizado, segue so com o que a pessoa digitou.
  const found = account?.calendly_uri
    ? await findScheduledEventForInvitee(
        meeting.professional_id,
        account.calendly_uri,
        meeting.contact_email,
        meeting.created_at,
        start.toISOString(),
      )
    : null;

  if (found?.ok && found.data) {
    return applyCalendlyConfirmation(admin, meeting, isClientSide, {
      start: new Date(found.data.startTime),
      end: new Date(found.data.endTime),
      eventUri: found.data.uri,
      joinUrl: found.data.joinUrl,
    });
  }

  return applyCalendlyConfirmation(admin, meeting, isClientSide, {
    start,
    end,
    eventUri: null,
    joinUrl: null,
  });
}

/**
 * Reunioes confirmadas na mao (formulario manual, sem achar o evento na
 * hora) ficam sem link de video ate alguem tentar de novo — esta acao existe
 * para isso: reunioes que ja foram confirmadas por outro meio antes desta
 * tentativa automatica existir, ou onde a Calendly nao tinha sincronizado
 * ainda no momento da confirmacao.
 */
export async function retryCalendlyLinkAction(requestId: string): Promise<ActionResult<{ found: boolean }>> {
  const actor = await getActor();
  if (!actor) return fail("Sessao expirada.");

  const admin = createAdminClient();
  const { data: meeting } = await admin
    .from("meeting_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!meeting) return fail("Pedido de reuniao nao encontrado.");
  if (meeting.method !== "calendly" || meeting.status !== "scheduled") {
    return fail("So da para buscar o link de reunioes ja agendadas pelo Calendly.");
  }
  if (meeting.meet_link) return ok({ found: true });

  const isClientSide = actor.role === "client" && actor.client?.id === meeting.client_id;
  if (!isClientSide) {
    const supabase = await createClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", meeting.client_id)
      .maybeSingle();
    if (!client) return fail("Sem permissao para este cliente.");
  }

  const { data: account } = await admin
    .from("professional_calendly_accounts")
    .select("calendly_uri")
    .eq("user_id", meeting.professional_id)
    .maybeSingle();
  if (!account) return fail("Profissional sem Calendly conectado.");

  const found = await findScheduledEventForInvitee(
    meeting.professional_id,
    account.calendly_uri,
    meeting.contact_email,
    meeting.created_at,
    meeting.scheduled_start ?? undefined,
  );
  if (!found.ok) return fail(found.error);
  if (!found.data) return ok({ found: false });

  const { error } = await admin
    .from("meeting_requests")
    .update({
      calendly_event_uri: found.data.uri,
      meet_link: found.data.joinUrl,
      scheduled_start: found.data.startTime,
      scheduled_end: found.data.endTime,
    })
    .eq("id", meeting.id);
  if (error) return fail(describeError(error, "Nao foi possivel atualizar."));

  revalidateMeetings(meeting.client_id);
  return ok({ found: true });
}
