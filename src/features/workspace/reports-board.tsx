import { BarChart3, Users } from "lucide-react";

import { ClientPicker } from "@/components/reports/client-picker";
import { MetricFormModal } from "@/components/reports/metric-form-modal";
import { MetricRow } from "@/components/reports/metric-row";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function ReportsBoard({ clientId }: { clientId?: string }) {
  const actor = await requireStaff();
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("professional_id", actor.authUser.id)
    .eq("status", "active")
    .order("company_name");

  const clientOptions = (clients ?? []).map((client) => ({
    id: client.id,
    companyName: client.company_name,
  }));

  const { data: metrics } = clientId
    ? await supabase
        .from("client_metrics")
        .select("*")
        .eq("client_id", clientId)
        .order("period_date", { ascending: false })
        .order("metric_name")
    : { data: [] };

  const rows = metrics ?? [];

  return (
    <>
      <PageHeader
        title="Relatorios"
        description="Cadastre e acompanhe as metricas de cada cliente por periodo. No futuro, um botao vai puxar essas metricas direto da conta do cliente."
        actions={clientId ? <MetricFormModal clientId={clientId} /> : undefined}
      />

      <div className="mb-5">
        <ClientPicker clients={clientOptions} value={clientId} />
      </div>

      {!clientId ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Selecione um cliente"
          description="Escolha um cliente acima para ver e cadastrar as metricas dele."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="Nenhuma metrica cadastrada"
          description="Cadastre a primeira metrica deste cliente para comecar a acompanhar a evolucao."
          action={<MetricFormModal clientId={clientId} />}
        />
      ) : (
        <div className="card p-4 sm:p-5">
          <div className="scroll-slim overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1.4fr_auto] gap-3 border-b border-line px-1 pb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                <span>Metrica</span>
                <span>Valor</span>
                <span>Periodo</span>
                <span>Observacoes</span>
                <span className="text-right">Acoes</span>
              </div>
              {rows.map((metric) => (
                <MetricRow key={metric.id} metric={metric} clientId={clientId} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
