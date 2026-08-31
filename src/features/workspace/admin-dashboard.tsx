import { Activity, HardDrive, Users, UserCog, Wallet, Images } from "lucide-react";

import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { formatBytes, formatRelativeDay } from "@/lib/utils";
import { loadAdminDashboardStats, loadClientActivities } from "@/server/queries";

/**
 * Dashboard do admin: visao geral de como os profissionais estao usando o
 * app, nao o dia a dia de um cliente — isso fica dentro de Profissionais.
 */
export async function AdminDashboard() {
  await requireAdmin();
  const supabase = await createClient();

  const [stats, activities] = await Promise.all([
    loadAdminDashboardStats(supabase),
    loadClientActivities(supabase, 10),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visao geral de como os profissionais estao usando o app."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Profissionais ativos" value={stats.activeProfessionals} />
        <StatCard label="Clientes ativos" value={stats.activeClients} />
        <StatCard label="Conteudos aprovados" value={stats.approvedContents} tone="success" />
        <StatCard label="Armazenamento usado" value={formatBytes(stats.storageBytes)} tone="info" />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Receita paga"
            description="Soma do que os profissionais ja marcaram como pago."
          />
          {stats.paidRevenue.length === 0 ? (
            <p className="text-sm text-ink-500">Nenhuma cobranca paga ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.paidRevenue.map((row) => (
                <li key={row.currency} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-ink-600">
                    <Wallet className="size-4 text-ink-400" aria-hidden />
                    {row.currency}
                  </span>
                  <span className="text-sm font-semibold text-ink-900 tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Atividades recentes" description="O que a equipe fez por ultimo." />
          {activities.length === 0 ? (
            <EmptyState
              icon={<Activity className="size-5" />}
              title="Nada por aqui ainda"
              description="Assim que a equipe agir em algum cliente, aparece aqui."
            />
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
                    <p className="text-xs text-ink-400">{formatRelativeDay(activity.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <UserCog className="size-4" aria-hidden />
          </span>
          <p className="text-xs text-ink-500">
            Gerenciar profissionais e entrar nos clientes de cada um em{" "}
            <span className="font-medium text-ink-700">Profissionais</span>.
          </p>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Users className="size-4" aria-hidden />
          </span>
          <p className="text-xs text-ink-500">
            Falar com a equipe em <span className="font-medium text-ink-700">Chat</span>.
          </p>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Images className="size-4" aria-hidden />
          </span>
          <p className="text-xs text-ink-500">
            Ver consumo de banco e Storage em{" "}
            <span className="font-medium text-ink-700 flex items-center gap-1 inline-flex">
              <HardDrive className="size-3" aria-hidden />
              Plataforma
            </span>
            .
          </p>
        </div>
      </div>
    </>
  );
}
