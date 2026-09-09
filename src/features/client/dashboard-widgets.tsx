import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Activity, ArrowRight, CalendarDays, CalendarClock, ExternalLink, Layers, Link2, Video } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/layout";
import { CONTENT_TYPE_LABEL, formatMoney, linkProviderLabel } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n/dictionary";
import { intlLocale, type Locale } from "@/lib/i18n/locale";
import { formatDate, formatRelativeDay } from "@/lib/utils";
import {
  loadClientActivities,
  loadClientMeetings,
  loadClientReferences,
  loadClientServices,
  loadUpcomingContents,
} from "@/server/queries";
import type { Database, MeetingRequestRow } from "@/types/database";

type Client = SupabaseClient<Database>;

/** Os 3 proximos conteudos com data de publicacao agendada. */
export async function PublicationsCalendarWidget({
  supabase,
  locale,
}: {
  supabase: Client;
  locale: Locale;
}) {
  const dict = getDictionary(locale).dashboardWidgets;
  const contents = await loadUpcomingContents(supabase, 3);

  return (
    <Card>
      <CardHeader title={dict.calendarTitle} />
      {contents.length === 0 ? (
        <p className="text-sm text-ink-500">{dict.calendarEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {contents.map((content) => (
            <li key={content.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                <CalendarDays className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{content.title}</p>
                <p className="text-xs text-ink-500">
                  {locale === "en" ? getDictionary(locale).contentType[content.type] : CONTENT_TYPE_LABEL[content.type]}
                  <span className="text-ink-300"> · </span>
                  {formatDate(content.scheduled_date, intlLocale(locale))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Servicos combinados com o cliente, com o valor de cada um. */
export async function ActiveProjectsWidget({
  supabase,
  locale,
}: {
  supabase: Client;
  locale: Locale;
}) {
  const dict = getDictionary(locale).dashboardWidgets;
  const services = await loadClientServices(supabase);

  return (
    <Card>
      <CardHeader title={dict.projectsTitle} />
      {services.length === 0 ? (
        <p className="text-sm text-ink-500">{dict.projectsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {services.map((service) => (
            <li key={service.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-ink-900">
                <Layers className="size-4 shrink-0 text-ink-400" aria-hidden />
                <span className="truncate">{service.title}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-ink-900 tabular-nums">
                {service.is_partnership ? dict.partnershipLabel : formatMoney(service.amount!, service.currency, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Links de referencia que o profissional cadastrou pra o cliente gravar. */
export async function ReferenceBankWidget({
  supabase,
  locale,
}: {
  supabase: Client;
  locale: Locale;
}) {
  const dict = getDictionary(locale).dashboardWidgets;
  const references = await loadClientReferences(supabase);

  return (
    <Card>
      <CardHeader title={dict.referencesTitle} />
      {references.length === 0 ? (
        <p className="text-sm text-ink-500">{dict.referencesEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {references.map((reference) => (
            <li key={reference.id}>
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex items-center gap-2.5 rounded text-sm font-medium text-ink-900 hover:text-accent"
              >
                <Link2 className="size-4 shrink-0 text-ink-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{reference.title}</span>
                  <span className="block truncate text-xs font-normal text-ink-400">
                    {linkProviderLabel(reference.url)}
                  </span>
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-ink-300" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Ultimas acoes registradas neste cliente. */
export async function RecentActivityWidget({
  supabase,
  locale,
}: {
  supabase: Client;
  locale: Locale;
}) {
  const dict = getDictionary(locale).dashboardWidgets;
  const activities = await loadClientActivities(supabase, 8);

  return (
    <Card>
      <CardHeader title={dict.activityTitle} />
      {activities.length === 0 ? (
        <p className="text-sm text-ink-500">{dict.activityEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                <Activity className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-800">
                  <span className="font-medium text-ink-900">{activity.actor_name}</span>{" "}
                  {activity.action}
                </p>
                <p className="text-xs text-ink-400">
                  {formatRelativeDay(activity.created_at, intlLocale(locale))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function meetingStatusLabel(meeting: MeetingRequestRow, dict: ReturnType<typeof getDictionary>["meetings"]) {
  switch (meeting.status) {
    case "pending":
      return dict.statusPending;
    case "approved":
      return dict.statusApproved;
    case "declined":
      return dict.statusDeclined;
    case "cancelled":
      return dict.statusCancelled;
    case "scheduled":
      return dict.statusScheduled;
  }
}

/** Mesma logica de `meeting-requests-list.tsx`, sem os botoes de acao. */
function meetingWhenLabel(meeting: MeetingRequestRow, dict: ReturnType<typeof getDictionary>["meetings"], locale: Locale) {
  if (meeting.method === "calendly") {
    return meeting.scheduled_start
      ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(meeting.scheduled_start),
        )
      : dict.calendlyAwaitingLabel;
  }
  if (meeting.proposed_date && meeting.proposed_time) {
    const parsed = new Date(`${meeting.proposed_date}T${meeting.proposed_time}`);
    const datePart = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" }).format(parsed);
    return `${datePart} · ${meeting.proposed_time.slice(0, 5)}`;
  }
  return "—";
}

/**
 * Ultimas reunioes do cliente — pedidas por ele ou pelo profissional, dos
 * dois metodos (Google Meet e Calendly). So leitura: acoes (aprovar, abrir o
 * link) ficam na tela cheia de Reunioes, aqui e so um resumo do que esta
 * pendente e do que ja foi marcado.
 */
export async function MeetingsWidget({
  supabase,
  clientId,
  locale,
}: {
  supabase: Client;
  clientId: string;
  locale: Locale;
}) {
  const dict = getDictionary(locale).dashboardWidgets;
  const meetingsDict = getDictionary(locale).meetings;
  const meetings = await loadClientMeetings(supabase, clientId);

  const pendingCount = meetings.filter((meeting) => meeting.status === "pending").length;
  const scheduledCount = meetings.filter(
    (meeting) => meeting.status === "scheduled" || meeting.status === "approved",
  ).length;
  const latest = meetings.slice(0, 3);

  return (
    <Card>
      <CardHeader
        title={dict.meetingsTitle}
        actions={
          <Link
            href="/client/meetings"
            className="focus-ring inline-flex items-center gap-1 rounded text-sm font-medium text-accent"
          >
            {dict.meetingsSeeAll}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />

      {meetings.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
          <span>{dict.meetingsPending(pendingCount)}</span>
          <span className="text-ink-300">·</span>
          <span>{dict.meetingsScheduled(scheduledCount)}</span>
        </div>
      ) : null}

      {latest.length === 0 ? (
        <p className="text-sm text-ink-500">{dict.meetingsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {latest.map((meeting) => (
            <li key={meeting.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                {meeting.method === "calendly" ? (
                  <CalendarClock className="size-4" aria-hidden />
                ) : (
                  <Video className="size-4" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">
                  {meetingWhenLabel(meeting, meetingsDict, locale)}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {meeting.contact_email}
                  <span className="text-ink-300"> · </span>
                  {meetingStatusLabel(meeting, meetingsDict)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
