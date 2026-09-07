import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock,
  Images,
  Video,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/layout";
import { LinkButton } from "@/components/ui/button";
import { Sparkline } from "@/components/ui/sparkline";
import { basePath, requireStaff } from "@/lib/auth";
import { BulletinWidget } from "@/features/bulletin/bulletin-widget";
import { CONTENT_STATUS_TONE, formatMoney, type BadgeTone } from "@/lib/domain";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";
import {
  loadAttentionFeed,
  loadDashboardStats,
  loadMonthlyRevenueForecast,
  loadRevenueTrend,
  loadUpcomingContents,
  type AttentionItem,
} from "@/server/queries";

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date());

// Classes estaticas de proposito -- o Tailwind nao gera classe pra
// `bg-${variavel}` interpolado em runtime, so pra literais que ele consegue
// achar no codigo fonte. Mesmo padrao de `DOT_TONE` em calendar-view.tsx.
const DOT_TONE: Record<BadgeTone, string> = {
  neutral: "bg-ink-400",
  info: "bg-accent",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
};

const ATTENTION_ICON: Record<AttentionItem["kind"], typeof AlertTriangle> = {
  content_pending: Clock,
  content_adjustment: AlertTriangle,
  overdue_invoice: Banknote,
  stale_client: CalendarClock,
  meeting_pending: Video,
};

const ATTENTION_BADGE_LABEL: Record<AttentionItem["kind"], string> = {
  content_pending: "Aprovacao",
  content_adjustment: "Ajuste",
  overdue_invoice: "Vencida",
  stale_client: "Parado",
  meeting_pending: "Reuniao",
};

export async function WorkspaceDashboard() {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const [stats, revenueForecast, revenueTrend, attention, upcoming] = await Promise.all([
    loadDashboardStats(supabase),
    loadMonthlyRevenueForecast(supabase),
    loadRevenueTrend(supabase, 6),
    loadAttentionFeed(supabase, actor.authUser.id, base, 8),
    loadUpcomingContents(supabase, 5),
  ]);

  const summary =
    attention.length === 0
      ? "Tudo em dia -- nenhuma pendencia esperando por voce agora."
      : `${stats.pendingContents} conteudo(s) pendente(s), ${attention.length} item(ns) aguardando voce.`;

  return (
    <>
      <PageHeader
        title={`Ola, ${actor.displayName.split(" ")[0]}`}
        description={summary}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`${base}/content/new`}>Novo conteudo</LinkButton>
            <LinkButton href={`${base}/tasks`} variant="secondary">
              Nova tarefa
            </LinkButton>
            <LinkButton href={`${base}/ideas`} variant="secondary">
              Nova ideia
            </LinkButton>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes ativos" value={stats.activeClients} />
        <StatCard label="Conteudos pendentes" value={stats.pendingContents} tone="warning" />
        <StatCard label="Aguardando cliente" value={stats.awaitingClient} tone="info" />
        <StatCard label="Aprovados" value={stats.approved} tone="success" />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Receita paga nos ultimos 6 meses"
            description={revenueTrend ? `Em ${revenueTrend.currency}.` : undefined}
          />
          {revenueTrend ? (
            <Sparkline
              points={revenueTrend.points.map((point) => ({ value: point.amount, endTime: point.monthLabel }))}
              formatLabel={(point) =>
                `${point.endTime}: ${formatMoney(point.value, revenueTrend.currency)}`
              }
            />
          ) : (
            <p className="text-sm text-ink-500">Nenhuma cobranca paga nos ultimos 6 meses ainda.</p>
          )}
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Proximos posts</h2>
            <Link
              href={`${base}/calendar`}
              className="focus-ring text-sm font-medium text-accent hover:underline"
            >
              Ver calendario
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Images className="size-5" />}
                title="Nada agendado"
                description="Nenhum conteudo com data marcada nos proximos dias."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((content) => (
                <li key={content.id}>
                  <Link
                    href={`${base}/content/${content.id}`}
                    className="focus-ring flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50"
                  >
                    <span
                      className={cn("size-2 shrink-0 rounded-full", DOT_TONE[CONTENT_STATUS_TONE[content.status]])}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                      {content.title}
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">
                      {content.scheduled_date ? formatDate(content.scheduled_date) : "—"}
                      {content.scheduled_time ? ` · ${content.scheduled_time.slice(0, 5)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-8">
        <Card padded={false}>
          <CardHeader
            title="Precisa de atencao"
            description="Tudo que espera uma acao sua ou do cliente, de todos os clientes."
            actions={
              <Link href={`${base}/clients`} className="focus-ring text-sm font-medium text-accent hover:underline">
                Ver clientes
              </Link>
            }
          />

          {attention.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState icon={<CheckCircle2 className="size-5" />} title="Tudo em dia por aqui" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((item, index) => {
                const Icon = ATTENTION_ICON[item.kind];
                return (
                  <li key={`${item.clientId}-${item.kind}-${index}`}>
                    <Link
                      href={item.href}
                      className="focus-ring flex items-center gap-4 px-5 py-3.5 transition hover:bg-ink-50"
                    >
                      <Icon className="size-4 shrink-0 text-ink-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">{item.clientName}</p>
                        <p className="truncate text-xs text-ink-500">{item.label}</p>
                      </div>
                      <Badge tone={item.tone}>{ATTENTION_BADGE_LABEL[item.kind]}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader
            title={`Receita prevista de ${MONTH_LABEL}`}
            description="Soma das cobrancas com vencimento neste mes, pagas ou em aberto."
          />
          {revenueForecast.length === 0 ? (
            <p className="text-sm text-ink-500">Nenhuma cobranca vencendo neste mes.</p>
          ) : (
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {revenueForecast.map((row) => (
                <li key={row.currency} className="flex items-center gap-2">
                  <Wallet className="size-4 text-ink-400" aria-hidden />
                  <span className="text-lg font-semibold text-ink-900 tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <BulletinWidget
        supabase={supabase}
        basePath={base}
        isAdmin={actor.role === "admin"}
        locale={DEFAULT_LOCALE}
      />
    </>
  );
}
