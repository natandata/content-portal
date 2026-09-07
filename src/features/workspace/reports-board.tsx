import { AlertTriangle, BarChart3, Users } from "lucide-react";

import { InstagramConnectCard } from "@/components/instagram/instagram-connect-card";
import { ClientPicker } from "@/components/reports/client-picker";
import { InstagramPublicReportCard } from "@/components/reports/instagram-public-report-card";
import { InstagramPublicReportForm } from "@/components/reports/instagram-public-report-form";
import { MetricFormModal } from "@/components/reports/metric-form-modal";
import { MetricRow } from "@/components/reports/metric-row";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { EmptyState } from "@/components/ui/feedback";
import { Card, CardHeader, PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { apifyConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const ERROR_MESSAGE: Record<string, string> = {
  instagram_denied: "Voce cancelou a conexao no Instagram.",
  instagram_invalid_state: "A conexao expirou ou foi aberta em outra aba. Tente de novo.",
  instagram_session: "Sua sessao expirou durante a conexao. Entre novamente e tente de novo.",
  instagram_exchange_failed: "Falha ao confirmar a conexao com o Instagram. Tente de novo.",
  instagram_save_failed: "A conexao funcionou, mas nao foi possivel salvar. Tente de novo.",
};

export async function ReportsBoard({ clientId, error }: { clientId?: string; error?: string }) {
  const actor = await requireStaff();
  const supabase = await createClient();
  const apifyConfigured = Boolean(apifyConfig());

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

  const { data: publicReports } =
    clientId && apifyConfigured
      ? await supabase
          .from("instagram_public_reports")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
      : { data: [] };

  return (
    <>
      {clientId ? (
        <RealtimeRefresh
          channelKey={`instagram-reports-${clientId}`}
          tables="instagram_public_reports,instagram_insights_reports,client_instagram_connections"
        />
      ) : null}

      <PageHeader
        title="Relatorios"
        description="Cadastre e acompanhe as metricas de cada cliente por periodo. No futuro, um botao vai puxar essas metricas direto da conta do cliente."
        actions={clientId ? <MetricFormModal clientId={clientId} /> : undefined}
      />

      {error && ERROR_MESSAGE[error] ? (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{ERROR_MESSAGE[error]}</p>
        </Card>
      ) : null}

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

      {clientId ? (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="Perfil publico"
              description="Scrape de um @ qualquer (o do proprio cliente ou de um concorrente), sem login -- seguidores, bio e posts recentes."
            />

            {!apifyConfigured ? (
              <p className="flex items-start gap-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Ainda nao configurado nesta instalacao.
              </p>
            ) : (
              <div className="space-y-4">
                <InstagramPublicReportForm clientId={clientId} />
                {(publicReports ?? []).length > 0 ? (
                  <div className="space-y-4">
                    {(publicReports ?? []).map((report) => (
                      <InstagramPublicReportCard key={report.id} report={report} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <InstagramConnectCard clientId={clientId} />
          </Card>
        </div>
      ) : null}
    </>
  );
}
