"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CheckSquare, ChevronLeft, ChevronRight, Images } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { RescheduleModal } from "@/components/calendar/reschedule-modal";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/domain";
import type { CalendarEntry } from "@/features/workspace/calendar-board";

type ViewMode = "month" | "week" | "day";
type Source = "posts" | "tasks";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

/** YYYY-MM-DD no fuso local — evita o desvio de dia que toISOString() causa. */
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

const DOT_TONE: Record<BadgeTone, string> = {
  neutral: "bg-ink-400",
  info: "bg-accent",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
};

function EntryPill({
  entry,
  onClick,
  compact,
}: {
  entry: CalendarEntry;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-xs transition hover:bg-ink-100",
        compact && "py-0.5",
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_TONE[entry.tone])} aria-hidden />
      {entry.time ? (
        <span className="shrink-0 tabular-nums text-ink-400">{entry.time.slice(0, 5)}</span>
      ) : null}
      <span className="truncate font-medium text-ink-700">{entry.title}</span>
    </button>
  );
}

export function CalendarView({ posts, tasks }: { posts: CalendarEntry[]; tasks: CalendarEntry[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [source, setSource] = useState<Source>("posts");
  const [referenceDate, setReferenceDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const entries = source === "posts" ? posts : tasks;

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
    }
    return map;
  }, [entries]);

  function openEntry(entry: CalendarEntry) {
    setSelected(entry);
    setModalOpen(true);
  }

  function navigate(direction: 1 | -1) {
    if (viewMode === "month") {
      setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    } else if (viewMode === "week") {
      setReferenceDate((prev) => addDays(prev, direction * 7));
    } else {
      setReferenceDate((prev) => addDays(prev, direction));
    }
  }

  const title = useMemo(() => {
    if (viewMode === "day") {
      return referenceDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "week") {
      const start = startOfWeek(referenceDate);
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const startLabel = start.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: sameMonth ? undefined : "short",
      });
      const endLabel = end.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return `${startLabel} – ${endLabel}`;
    }
    return referenceDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [viewMode, referenceDate]);

  return (
    <div>
      {/* Posts x Tarefas: troca o que o calendario inteiro esta mostrando. */}
      <div className="mb-4 flex w-fit rounded-lg border border-line bg-ink-50 p-0.5">
        {([
          { value: "posts", label: "Posts", icon: Images, count: posts.length },
          { value: "tasks", label: "Tarefas", icon: CheckSquare, count: tasks.length },
        ] as const).map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSource(option.value)}
              className={cn(
                "focus-ring flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
                source === option.value
                  ? "bg-surface text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-800",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {option.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  source === option.value ? "bg-ink-100 text-ink-600" : "text-ink-400",
                )}
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <h2 className="min-w-[180px] text-center text-sm font-semibold text-ink-900 capitalize sm:text-left">
            {title}
          </h2>
          <Button variant="secondary" size="sm" onClick={() => navigate(1)}>
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
            Hoje
          </Button>
        </div>

        <div className="flex rounded-lg border border-line bg-ink-50 p-0.5">
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                "focus-ring rounded-md px-3 py-1.5 text-xs font-medium transition",
                viewMode === mode
                  ? "bg-surface text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-800",
              )}
            >
              {mode === "month" ? "Mes" : mode === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "month" ? (
        <MonthGrid referenceDate={referenceDate} entriesByDay={entriesByDay} onSelect={openEntry} />
      ) : viewMode === "week" ? (
        <WeekGrid referenceDate={referenceDate} entriesByDay={entriesByDay} onSelect={openEntry} />
      ) : (
        <DayList
          referenceDate={referenceDate}
          entriesByDay={entriesByDay}
          onSelect={openEntry}
          source={source}
        />
      )}

      <RescheduleModal entry={selected} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function MonthGrid({
  referenceDate,
  entriesByDay,
  onSelect,
}: {
  referenceDate: Date;
  entriesByDay: Map<string, CalendarEntry[]>;
  onSelect: (entry: CalendarEntry) => void;
}) {
  const firstOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const today = toDateKey(new Date());

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-line bg-ink-50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[11px] font-semibold text-ink-500 uppercase"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = day.getMonth() === referenceDate.getMonth();
          const dayEntries = entriesByDay.get(key) ?? [];
          const isToday = key === today;

          return (
            <div
              key={key}
              className={cn(
                "min-h-[96px] border-r border-b border-line p-1.5 last:border-r-0",
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
              <div className="space-y-0.5">
                {dayEntries.slice(0, 3).map((entry) => (
                  <EntryPill key={entry.id} entry={entry} onClick={() => onSelect(entry)} compact />
                ))}
                {dayEntries.length > 3 ? (
                  <p className="px-1.5 text-[11px] text-ink-400">+{dayEntries.length - 3} mais</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  referenceDate,
  entriesByDay,
  onSelect,
}: {
  referenceDate: Date;
  entriesByDay: Map<string, CalendarEntry[]>;
  onSelect: (entry: CalendarEntry) => void;
}) {
  const start = startOfWeek(referenceDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = toDateKey(new Date());

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((day) => {
        const key = toDateKey(day);
        const dayEntries = entriesByDay.get(key) ?? [];
        const isToday = key === today;

        return (
          <div key={key} className="card flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-500 uppercase">
                {WEEKDAY_LABELS[day.getDay()]}
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday ? "bg-ink-900 text-on-ink" : "text-ink-700",
                )}
              >
                {day.getDate()}
              </span>
            </div>
            <div className="space-y-1">
              {dayEntries.length === 0 ? (
                <p className="text-xs text-ink-300">Vazio</p>
              ) : (
                dayEntries.map((entry) => (
                  <EntryPill key={entry.id} entry={entry} onClick={() => onSelect(entry)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayList({
  referenceDate,
  entriesByDay,
  onSelect,
  source,
}: {
  referenceDate: Date;
  entriesByDay: Map<string, CalendarEntry[]>;
  onSelect: (entry: CalendarEntry) => void;
  source: Source;
}) {
  const key = toDateKey(referenceDate);
  const dayEntries = entriesByDay.get(key) ?? [];

  if (dayEntries.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-5" />}
        title={source === "posts" ? "Nenhum post agendado" : "Nenhuma tarefa com prazo"}
        description={
          source === "posts"
            ? "Nao ha conteudos agendados para este dia."
            : "Nenhuma tarefa vence neste dia."
        }
      />
    );
  }

  return (
    <div className="card divide-y divide-line p-0">
      {dayEntries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onSelect(entry)}
          className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50"
        >
          <span className="w-14 shrink-0 tabular-nums text-sm text-ink-500">
            {entry.time ? entry.time.slice(0, 5) : "—"}
          </span>
          <span className={cn("size-2 shrink-0 rounded-full", DOT_TONE[entry.tone])} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink-900">{entry.title}</span>
            <span className="block truncate text-xs text-ink-500">
              {entry.subtitle ?? entry.statusLabel}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
