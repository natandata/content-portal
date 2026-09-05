"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Clock, ExternalLink, Video, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { intlLocale, type Locale } from "@/lib/i18n/locale";
import { cancelMeetingRequestAction, respondMeetingRequestAction } from "@/server/actions/meetings";
import type { MeetingRequestRow } from "@/types/database";

type MeetingsDict = Dictionary["meetings"];

function statusMeta(dict: MeetingsDict) {
  return {
    pending: { label: dict.statusPending, tone: "warning" as const },
    approved: { label: dict.statusApproved, tone: "success" as const },
    declined: { label: dict.statusDeclined, tone: "danger" as const },
    cancelled: { label: dict.statusCancelled, tone: "neutral" as const },
  };
}

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
  meeting: MeetingRequestRow;
  isMine: boolean;
  dict: MeetingsDict;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const meta = statusMeta(dict)[meeting.status];

  // "isMine" = fui eu que pedi. So quem NAO pediu ve aprovar/recusar.
  const canRespond = meeting.status === "pending" && !isMine;
  const canCancel = meeting.status === "pending" || meeting.status === "approved";

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

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
          <Clock className="size-4 shrink-0 text-ink-400" aria-hidden />
          {dateLabel(meeting.proposed_date, meeting.proposed_time, locale)}
        </p>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <p className="text-xs text-ink-500">
        {dict.contactLabel}: {meeting.contact_email}
      </p>
      {meeting.message ? <p className="text-sm text-ink-600">{meeting.message}</p> : null}

      {meeting.status === "approved" && meeting.meet_link ? (
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

      {canRespond || canCancel ? (
        <div className="flex flex-wrap gap-2 pt-1">
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
        </div>
      ) : null}
    </div>
  );
}

export function MeetingRequestsList({
  meetings,
  currentSide,
  locale = "pt-BR",
}: {
  meetings: MeetingRequestRow[];
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
