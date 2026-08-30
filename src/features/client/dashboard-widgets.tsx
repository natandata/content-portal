import type { SupabaseClient } from "@supabase/supabase-js";
import { Activity, CalendarDays, Layers } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/layout";
import { CONTENT_TYPE_LABEL, formatMoney } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n/dictionary";
import { intlLocale, type Locale } from "@/lib/i18n/locale";
import { formatDate, formatRelativeDay } from "@/lib/utils";
import { loadClientActivities, loadClientServices, loadUpcomingContents } from "@/server/queries";
import type { Database } from "@/types/database";

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
                {formatMoney(service.amount, service.currency, locale)}
              </span>
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
