"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Images, Layers, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { CONTENT_STATUS_TONE } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n/dictionary";
import { intlLocale, type Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { ClientCalendarPost } from "@/server/queries";

/** Dom..Sab (ou Sun..Sat) a partir de uma semana de referencia qualquer — nao depende do mes atual. */
function weekdayLabels(locale: Locale): string[] {
  const formatter = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" });
  const reference = new Date(2026, 0, 4); // um domingo, so como ancora
  return Array.from({ length: 7 }, (_, i) => formatter.format(addDays(reference, i)));
}

const TYPE_ICON = { image: Images, video: Video, carousel: Layers };

const TONE_DOT: Record<string, string> = {
  neutral: "bg-ink-400",
  info: "bg-accent",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
};

const TONE_BAR: Record<string, string> = {
  neutral: "bg-ink-400/15 text-ink-700",
  info: "bg-accent/15 text-accent",
  warning: "bg-amber-400/20 text-amber-700",
  success: "bg-emerald-400/20 text-emerald-700",
  danger: "bg-red-400/20 text-red-700",
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

/**
 * Card que "salta" da data ao passar o mouse — puro CSS (:hover), sem estado
 * em React. E o que garante abrir e fechar sem nenhuma demora: nao ha
 * transicao de opacidade nem debounce, so `hidden`/`block` no hover do pai.
 */
function DayPreview({
  post,
  basePath,
  align,
  statusLabels,
  typeLabels,
}: {
  post: ClientCalendarPost;
  basePath: string;
  align: "start" | "end";
  statusLabels: Record<string, string>;
  typeLabels: Record<string, string>;
}) {
  const Icon = TYPE_ICON[post.type];
  return (
    <Link
      href={`${basePath}/content/${post.id}`}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "focus-ring absolute top-full z-20 mt-1 hidden w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-lg group-hover/day:block",
        align === "start" ? "left-0" : "right-0",
      )}
    >
      <div className="relative h-28 w-full bg-ink-100">
        {post.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Icon className="size-6 text-ink-300" aria-hidden />
          </div>
        )}
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white",
            TONE_DOT[CONTENT_STATUS_TONE[post.status]],
          )}
        >
          {statusLabels[post.status]}
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-xs font-semibold text-ink-900">{post.title}</p>
        {post.caption ? <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-500">{post.caption}</p> : null}
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-400">
          <Icon className="size-3" aria-hidden />
          {typeLabels[post.type]}
          {post.time ? <span className="tabular-nums">· {post.time.slice(0, 5)}</span> : null}
        </p>
      </div>
    </Link>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  posts,
  basePath,
  align,
  moreLabel,
  statusLabels,
  typeLabels,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  posts: ClientCalendarPost[];
  basePath: string;
  align: "start" | "end";
  moreLabel: (count: number) => string;
  statusLabels: Record<string, string>;
  typeLabels: Record<string, string>;
}) {
  const first = posts[0];

  return (
    <div
      className={cn(
        "group/day relative min-h-[92px] border-r border-b border-line p-1.5 last:border-r-0",
        !inMonth && "bg-ink-50/40",
      )}
    >
      <span
        className={cn(
          "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
          isToday ? "bg-ink-900 text-on-ink" : inMonth ? "text-ink-700" : "text-ink-300",
        )}
      >
        {day.getDate()}
      </span>

      {posts.length > 0 ? (
        <div className="space-y-1">
          {posts.slice(0, 2).map((post) => (
            <div
              key={post.id}
              className={cn(
                "flex items-center gap-1 truncate rounded-md px-1.5 py-1 text-[11px] font-medium",
                TONE_BAR[CONTENT_STATUS_TONE[post.status]],
              )}
            >
              {post.time ? <span className="shrink-0 tabular-nums text-ink-500">{post.time.slice(0, 5)}</span> : null}
              <span className="truncate">{post.title}</span>
            </div>
          ))}
          {posts.length > 2 ? (
            <p className="px-1.5 text-[10px] text-ink-400">{moreLabel(posts.length - 2)}</p>
          ) : null}
        </div>
      ) : null}

      {/* O preview mostra sempre o primeiro post do dia — se tiver mais de um,
          o card em si (ou "+N mais") continua clicavel para ver a lista completa. */}
      {first ? (
        <DayPreview post={first} basePath={basePath} align={align} statusLabels={statusLabels} typeLabels={typeLabels} />
      ) : null}
    </div>
  );
}

export function ClientContentCalendar({
  posts,
  basePath,
  locale = "pt-BR",
}: {
  posts: ClientCalendarPost[];
  basePath: string;
  locale?: Locale;
}) {
  const dict = getDictionary(locale).postCalendar;
  const statusLabels = getDictionary(locale).status.content;
  const typeLabels = getDictionary(locale).contentType;
  const moreLabel = (count: number) => (locale === "en" ? `+${count} more` : `+${count} mais`);

  const [referenceDate, setReferenceDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  const postsByDay = useMemo(() => {
    const map = new Map<string, ClientCalendarPost[]>();
    for (const post of posts) {
      const list = map.get(post.date) ?? [];
      list.push(post);
      map.set(post.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
    }
    return map;
  }, [posts]);

  const firstOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const today = toDateKey(new Date());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const title = referenceDate.toLocaleDateString(intlLocale(locale), { month: "long", year: "numeric" });

  if (posts.length === 0) {
    return <EmptyState icon={<CalendarClock className="size-5" />} title={dict.empty} description={dict.emptyBody} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <h2 className="min-w-[160px] text-sm font-semibold text-ink-900 capitalize">{title}</h2>
        <Button variant="secondary" size="sm" onClick={() => setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            setReferenceDate(now);
          }}
        >
          {dict.today}
        </Button>
      </div>

      <div className="card overflow-visible p-0">
        <div className="grid grid-cols-7 border-b border-line bg-ink-50">
          {weekdayLabels(locale).map((label) => (
            <div key={label} className="px-2 py-2 text-center text-[11px] font-semibold text-ink-500 uppercase">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const key = toDateKey(day);
            const column = index % 7;
            return (
              <DayCell
                key={key}
                day={day}
                inMonth={day.getMonth() === referenceDate.getMonth()}
                isToday={key === today}
                posts={postsByDay.get(key) ?? []}
                basePath={basePath}
                align={column >= 5 ? "end" : "start"}
                moreLabel={moreLabel}
                statusLabels={statusLabels}
                typeLabels={typeLabels}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
