"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ClientDetailTabs } from "@/components/clients/client-detail-tabs";
import { MeetingRequestsList, type MeetingWithClient } from "@/components/meetings/meeting-requests-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Card } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

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

/** Data/hora real da reuniao, quando existir — Calendly so tem depois de
 * marcada; google_meet sempre tem (e a propria proposta). */
function effectiveDate(meeting: MeetingWithClient): Date | null {
  if (meeting.method === "calendly") {
    return meeting.scheduled_start ? new Date(meeting.scheduled_start) : null;
  }
  if (meeting.proposed_date && meeting.proposed_time) {
    return new Date(`${meeting.proposed_date}T${meeting.proposed_time}`);
  }
  return null;
}

export function MeetingsOverviewClient({ meetings }: { meetings: MeetingWithClient[] }) {
  if (meetings.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title="Nenhuma reuniao ainda"
          description="Pedidos de reuniao dos seus clientes (ou seus, para eles) aparecem aqui."
        />
      </Card>
    );
  }

  return (
    <ClientDetailTabs
      tabs={[
        { id: "lista", label: "Lista", content: <ListView meetings={meetings} /> },
        { id: "calendario", label: "Calendario", content: <CalendarTab meetings={meetings} /> },
        { id: "cliente", label: "Por Cliente", content: <ByClientView meetings={meetings} /> },
      ]}
    />
  );
}

function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </h3>
  );
}

function ListView({ meetings }: { meetings: MeetingWithClient[] }) {
  const { pending, upcoming, past } = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const pending = meetings
      .filter((m) => m.status === "pending")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const settled = meetings.filter((m) => m.status !== "pending");
    const upcoming = settled
      .filter((m) => {
        const date = effectiveDate(m);
        return (m.status === "approved" || m.status === "scheduled") && date !== null && date >= startOfToday;
      })
      .sort((a, b) => (effectiveDate(a)?.getTime() ?? 0) - (effectiveDate(b)?.getTime() ?? 0));

    const upcomingIds = new Set(upcoming.map((m) => m.id));
    const past = settled
      .filter((m) => !upcomingIds.has(m.id))
      .sort((a, b) => (effectiveDate(b)?.getTime() ?? 0) - (effectiveDate(a)?.getTime() ?? 0));

    return { pending, upcoming, past };
  }, [meetings]);

  return (
    <div className="space-y-6">
      {pending.length > 0 ? (
        <section>
          <SectionLabel icon={CalendarClock}>Pendentes ({pending.length})</SectionLabel>
          <MeetingRequestsList meetings={pending} currentSide="professional" />
        </section>
      ) : null}

      <section>
        <SectionLabel icon={CalendarClock}>Futuras ({upcoming.length})</SectionLabel>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhuma reuniao futura confirmada.</p>
        ) : (
          <MeetingRequestsList meetings={upcoming} currentSide="professional" />
        )}
      </section>

      <section>
        <SectionLabel icon={CalendarClock}>Passadas ({past.length})</SectionLabel>
        {past.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhuma reuniao passada ainda.</p>
        ) : (
          <MeetingRequestsList meetings={past} currentSide="professional" />
        )}
      </section>
    </div>
  );
}

function CalendarTab({ meetings }: { meetings: MeetingWithClient[] }) {
  const [referenceDate, setReferenceDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selectedDay, setSelectedDay] = useState(() => toDateKey(new Date()));

  const undated = useMemo(() => meetings.filter((m) => effectiveDate(m) === null), [meetings]);

  const byDay = useMemo(() => {
    const map = new Map<string, MeetingWithClient[]>();
    for (const meeting of meetings) {
      const date = effectiveDate(meeting);
      if (!date) continue;
      const key = toDateKey(date);
      const list = map.get(key) ?? [];
      list.push(meeting);
      map.set(key, list);
    }
    return map;
  }, [meetings]);

  const firstOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = toDateKey(new Date());
  const monthTitle = referenceDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const selectedMeetings = byDay.get(selectedDay) ?? [];

  return (
    <div className="space-y-4">
      {undated.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="mb-2 text-xs font-semibold text-amber-800 uppercase">
            Sem data definida ({undated.length})
          </p>
          <p className="text-xs text-amber-700">
            Pedidos pelo Calendly ainda nao marcados nao aparecem no calendario — veja na aba Lista.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <h2 className="min-w-[160px] text-sm font-semibold text-ink-900 capitalize">{monthTitle}</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                setReferenceDate(now);
                setSelectedDay(toDateKey(now));
              }}
            >
              Hoje
            </Button>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="grid grid-cols-7 border-b border-line bg-ink-50">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-2 py-2 text-center text-[11px] font-semibold text-ink-500 uppercase">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = toDateKey(day);
                const inMonth = day.getMonth() === referenceDate.getMonth();
                const dayMeetings = byDay.get(key) ?? [];
                const isToday = key === today;
                const isSelected = key === selectedDay;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(key)}
                    className={cn(
                      "focus-ring flex min-h-[76px] flex-col items-start gap-1 border-r border-b border-line p-1.5 text-left last:border-r-0 hover:bg-ink-50",
                      !inMonth && "bg-ink-50/40",
                      isSelected && "bg-accent-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday ? "bg-ink-900 text-on-ink" : inMonth ? "text-ink-700" : "text-ink-300",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayMeetings.length > 0 ? (
                      <span className="flex flex-wrap gap-0.5">
                        {dayMeetings.slice(0, 4).map((m) => (
                          <span key={m.id} className="size-1.5 rounded-full bg-accent" aria-hidden />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink-900">
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date(`${selectedDay}T00:00`))}
          </h3>
          {selectedMeetings.length === 0 ? (
            <p className="text-sm text-ink-500">Nenhuma reuniao neste dia.</p>
          ) : (
            <MeetingRequestsList meetings={selectedMeetings} currentSide="professional" />
          )}
        </div>
      </div>
    </div>
  );
}

function ByClientView({ meetings }: { meetings: MeetingWithClient[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; href?: string; meetings: MeetingWithClient[] }>();
    for (const meeting of meetings) {
      const entry = map.get(meeting.client_id) ?? {
        name: meeting.clientName ?? "Cliente",
        href: meeting.clientHref,
        meetings: [],
      };
      entry.meetings.push({ ...meeting, clientName: undefined, clientHref: undefined });
      map.set(meeting.client_id, entry);
    }
    return Array.from(map.entries())
      .map(([clientId, value]) => ({ clientId, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [meetings]);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <Card key={group.clientId}>
          <div className="mb-3 flex items-center justify-between gap-3">
            {group.href ? (
              <Link
                href={group.href}
                className="focus-ring flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-accent"
              >
                <Users className="size-4 shrink-0 text-ink-400" aria-hidden />
                {group.name}
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                <Users className="size-4 shrink-0 text-ink-400" aria-hidden />
                {group.name}
              </span>
            )}
            <span className="text-xs text-ink-400">
              {group.meetings.length === 1 ? "1 reuniao" : `${group.meetings.length} reunioes`}
            </span>
          </div>
          <MeetingRequestsList meetings={group.meetings} currentSide="professional" />
        </Card>
      ))}
    </div>
  );
}
