"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarCheck, CalendarClock, Check, Clock, ExternalLink, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { intlLocale, type Locale } from "@/lib/i18n/locale";
import {
  autoConfirmCalendlyMeetingAction,
  cancelMeetingRequestAction,
  confirmCalendlyMeetingAction,
  deleteMeetingRequestAction,
  respondMeetingRequestAction,
} from "@/server/actions/meetings";
import type { MeetingRequestRow } from "@/types/database";

type MeetingsDict = Dictionary["meetings"];

/** Extensao usada so na visao "todas as reunioes" do profissional (Visao
 * Geral > Reunioes) — cada linha vem de um cliente diferente, entao precisa
 * dizer de qual. No contexto de um unico cliente (aba Reunioes dele) esses
 * campos ficam de fora e a linha nao muda em nada. */
export type MeetingWithClient = MeetingRequestRow & { clientName?: string; clientHref?: string };

function statusMeta(dict: MeetingsDict) {
  return {
    pending: { label: dict.statusPending, tone: "warning" as const },
    approved: { label: dict.statusApproved, tone: "success" as const },
    declined: { label: dict.statusDeclined, tone: "danger" as const },
    cancelled: { label: dict.statusCancelled, tone: "neutral" as const },
    scheduled: { label: dict.statusScheduled, tone: "success" as const },
  };
}

/** Usado so pelo metodo google_meet, onde data e horario sao sempre preenchidos. */
function dateLabel(date: string, time: string, locale: Locale): string {
  const parsed = new Date(`${date}T${time}`);
  const datePart = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" }).format(parsed);
  return `${datePart} · ${time.slice(0, 5)}`;
}

function MeetingRow({
  meeting,
  isMine,
  dict,
  locale,
}: {
  meeting: MeetingWithClient;
  isMine: boolean;
  dict: MeetingsDict;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const meta = statusMeta(dict)[meeting.status];

  // "isMine" = fui eu que pedi. So quem NAO pediu ve aprovar/recusar — e so
  // existe aprovar/recusar no metodo google_meet: no metodo calendly a
  // disponibilidade real ja e a aprovacao, confirmada pelo webhook.
  const canRespond = meeting.method === "google_meet" && meeting.status === "pending" && !isMine;
  const canCancel =
    meeting.method === "calendly"
      ? meeting.status === "pending" || meeting.status === "scheduled"
      : meeting.status === "pending" || meeting.status === "approved";
  const canDelete = meeting.status === "cancelled";
  // So existe porque a assinatura de webhook exige plano pago da Calendly —
  // sem ela, a Calendly nunca avisa o app sozinha. Enquanto isso, quem
  // marcou confirma manualmente com a data/hora reais.
  const canConfirmCalendly = meeting.method === "calendly" && meeting.status === "pending";

  function respond(decision: "approved" | "declined") {
    start(async () => {
      const result = await respondMeetingRequestAction(meeting.id, decision);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(decision === "approved" ? dict.approvedToast : dict.declinedToast);
      router.refresh();
    });
  }

  function cancel() {
    start(async () => {
      const result = await cancelMeetingRequestAction(meeting.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(dict.cancelledToast);
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const result = await deleteMeetingRequestAction(meeting.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(dict.deletedToast);
      router.refresh();
    });
  }

  function tryAutoConfirm() {
    start(async () => {
      const result = await autoConfirmCalendlyMeetingAction(meeting.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (!result.data.found) {
        // Calendly ainda nao mostra o evento (pode nao ter sincronizado, ou
        // a API pode estar fora do ar) — cai no formulario manual.
        setConfirmOpen(true);
        return;
      }
      toast.success(dict.calendlyConfirmedToast);
      router.refresh();
    });
  }

  function submitManualConfirm() {
    // O input datetime-local nao carrega fuso — convertido aqui, no
    // navegador de quem preencheu, "sabe" o fuso local certo. Mandar a
    // string crua para o servidor deixaria a interpretacao a merce do
    // fuso de onde a funcao roda (nao o de quem marcou a reuniao).
    const iso = new Date(scheduledAt).toISOString();
    start(async () => {
      const result = await confirmCalendlyMeetingAction(meeting.id, { scheduledStart: iso });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(dict.calendlyConfirmedToast);
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
      {meeting.clientName ? (
        meeting.clientHref ? (
          <Link
            href={meeting.clientHref}
            className="focus-ring w-fit text-sm font-semibold text-ink-900 hover:text-accent"
          >
            {meeting.clientName}
          </Link>
        ) : (
          <p className="text-sm font-semibold text-ink-900">{meeting.clientName}</p>
        )
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
          <Clock className="size-4 shrink-0 text-ink-400" aria-hidden />
          {meeting.method === "calendly"
            ? meeting.scheduled_start
              ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(meeting.scheduled_start),
                )
              : dict.calendlyAwaitingLabel
            : meeting.proposed_date && meeting.proposed_time
              ? dateLabel(meeting.proposed_date, meeting.proposed_time, locale)
              : "—"}
        </p>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <p className="text-xs text-ink-500">
        {dict.contactLabel}: {meeting.contact_email}
      </p>
      {meeting.message ? <p className="text-sm text-ink-600">{meeting.message}</p> : null}

      {meeting.method === "calendly" && meeting.status === "pending" && meeting.calendly_booking_url ? (
        <a
          href={meeting.calendly_booking_url}
          target="_blank"
          rel="noreferrer"
          className="focus-ring flex w-fit items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-on-ink transition hover:bg-ink-800"
        >
          <CalendarClock className="size-3.5" aria-hidden />
          {dict.calendlyOpenButton}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}

      {(meeting.status === "approved" || meeting.status === "scheduled") && meeting.meet_link ? (
        <a
          href={meeting.meet_link}
          target="_blank"
          rel="noreferrer"
          className="focus-ring flex w-fit items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-on-ink transition hover:bg-ink-800"
        >
          <Video className="size-3.5" aria-hidden />
          {dict.joinMeet}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}

      {canRespond || canCancel || canDelete || canConfirmCalendly ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {canConfirmCalendly ? (
            <Button size="sm" variant="secondary" loading={pending} onClick={tryAutoConfirm}>
              <CalendarCheck className="size-3.5" aria-hidden />
              {dict.calendlyConfirmButton}
            </Button>
          ) : null}
          {canRespond ? (
            <>
              <Button size="sm" variant="success" loading={pending} onClick={() => respond("approved")}>
                <Check className="size-3.5" aria-hidden />
                {dict.approve}
              </Button>
              <Button size="sm" variant="ghost" loading={pending} onClick={() => respond("declined")}>
                <X className="size-3.5" aria-hidden />
                {dict.decline}
              </Button>
            </>
          ) : null}
          {canCancel ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              loading={pending}
              onClick={cancel}
            >
              {dict.cancelMeeting}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              loading={pending}
              onClick={remove}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {dict.deleteMeeting}
            </Button>
          ) : null}
        </div>
      ) : null}

      {canConfirmCalendly ? (
        <Modal
          open={confirmOpen}
          onClose={() => !pending && setConfirmOpen(false)}
          title={dict.calendlyConfirmModalTitle}
          description={dict.calendlyConfirmModalDescription}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={pending}>
                {dict.cancel}
              </Button>
              <Button loading={pending} disabled={!scheduledAt} onClick={submitManualConfirm}>
                {dict.calendlyConfirmSubmit}
              </Button>
            </>
          }
        >
          <Field label={dict.fieldScheduledAt} htmlFor={`scheduled-at-${meeting.id}`} required>
            <Input
              id={`scheduled-at-${meeting.id}`}
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              disabled={pending}
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}

export function MeetingRequestsList({
  meetings,
  currentSide,
  locale = "pt-BR",
}: {
  meetings: MeetingWithClient[];
  currentSide: "client" | "professional";
  locale?: Locale;
}) {
  const dict = getDictionary(locale).meetings;

  if (meetings.length === 0) {
    return <EmptyState icon={<Video className="size-5" />} title={dict.emptyTitle} description={dict.emptyBody} />;
  }

  return (
    <div className="space-y-3">
      {meetings.map((meeting) => (
        <MeetingRow
          key={meeting.id}
          meeting={meeting}
          isMine={meeting.requested_by === currentSide}
          dict={dict}
          locale={locale}
        />
      ))}
    </div>
  );
}
