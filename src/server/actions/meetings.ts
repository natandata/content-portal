"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActor } from "@/lib/auth";
import { cancelMeetEvent, createMeetEvent } from "@/lib/google/calendar";
import { sendPushToClient, sendPushToClientStaff } from "@/lib/push";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

const MEETING_DURATION_MINUTES = 30;

function revalidateMeetings(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/professional/clients/${clientId}`);
  revalidatePath("/client/meetings");
}

const requestSchema = z.object({
  clientId: z.uuid(),
  contactEmail: z.email("Informe um e-mail valido."),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da reuniao."),
  proposedTime: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horario da reuniao."),
  message: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || undefined),
});

/**
 * Cliente ou equipe propoe data/hora — a outra parte e quem aprova. Guarda so
 * a proposta; o evento no Google so nasce na aprovacao (`respondMeetingRequestAction`).
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

  const admin = createAdminClient();
  const { error } = await admin.from("meeting_requests").insert({
    client_id: clientId,
    professional_id: professionalId,
    requested_by: requestedBy,
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

  const { error } = await admin
    .from("meeting_requests")
    .update({ status: "cancelled" })
    .eq("id", meeting.id);

  if (error) return fail(describeError(error, "Nao foi possivel cancelar."));

  revalidateMeetings(meeting.client_id);
  return done();
}
