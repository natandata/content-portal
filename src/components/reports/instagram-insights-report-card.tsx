import { AlertTriangle, Loader2 } from "lucide-react";

import { formatDate, formatDateTime } from "@/lib/utils";
import type { InstagramInsightsReportRow } from "@/types/database";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Uma serie de metrica da Graph API: `{ data: [{ name, values: [{ value, end_time? }] }] }`. */
function metricSeries(raw: unknown, name: string): { value: number; endTime: string | null }[] {
  const data =
    raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : [];
  const entry = data.find(
    (item) => item && typeof item === "object" && (item as { name?: unknown }).name === name,
  ) as { values?: unknown[] } | undefined;

  return (entry?.values ?? [])
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
    .map((v) => ({ value: num(v.value) ?? 0, endTime: str(v.end_time) }));
}

function metricTotal(raw: unknown, name: string): number {
  return metricSeries(raw, name).reduce((sum, point) => sum + point.value, 0);
}

/** Insights de um post (per-post, `period=lifetime`): mesma forma, mas so um valor por metrica, sem `end_time`. */
function postMetricValue(insights: unknown, name: string): number | null {
  if (!Array.isArray(insights)) return null;
  const entry = insights.find(
    (item) => item && typeof item === "object" && (item as { name?: unknown }).name === name,
  ) as { values?: { value?: unknown }[] } | undefined;
  return num(entry?.values?.[0]?.value);
}

function Sparkline({ points }: { points: { value: number; endTime: string | null }[] }) {
  if (points.length === 0) return <p className="text-xs text-ink-400">Sem dados no periodo.</p>;
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="flex h-16 items-end gap-0.5">
      {points.map((point, index) => (
        <div
          key={index}
          className="min-w-[3px] flex-1 rounded-t bg-accent/70"
          style={{ height: `${Math.max((point.value / max) * 100, 2)}%` }}
          title={`${point.endTime ? formatDate(point.endTime.slice(0, 10)) : ""}: ${point.value.toLocaleString("pt-BR")}`}
        />
      ))}
    </div>
  );
}

/**
 * Relatorio de insights (relatorio 2). `account_metrics`/`posts` vem crus
 * da Composio (jsonb, jeito Graph API `{data:[{name,values:[...]}]}`) --
 * leitura defensiva, mesmo espirito de `InstagramPublicReportCard`.
 */
export function InstagramInsightsReportCard({ report }: { report: InstagramInsightsReportRow }) {
  if (report.status === "pending" || report.status === "running") {
    return (
      <div className="flex items-center gap-3 text-sm text-ink-600">
        <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
        Coletando insights dos ultimos {report.period_months} meses... isso pode levar um minuto.
      </div>
    );
  }

  if (report.status === "failed") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p>Falha ao gerar o relatorio.</p>
          {report.error ? <p className="mt-1 text-xs text-red-600">{report.error}</p> : null}
        </div>
      </div>
    );
  }

  const reachSeries = metricSeries(report.account_metrics, "reach");
  const interactionsSeries = metricSeries(report.account_metrics, "total_interactions");
  const posts = Array.isArray(report.posts) ? report.posts : [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Alcance no periodo ({metricTotal(report.account_metrics, "reach").toLocaleString("pt-BR")})
          </p>
          <Sparkline points={reachSeries} />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Interacoes no periodo ({metricTotal(report.account_metrics, "total_interactions").toLocaleString("pt-BR")})
          </p>
          <Sparkline points={interactionsSeries} />
        </div>
      </div>

      {posts.length > 0 ? (
        <div className="scroll-slim overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase">
              <tr>
                <th className="px-3 py-2">Post</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2 text-right">Alcance</th>
                <th className="px-3 py-2 text-right">Curtidas</th>
                <th className="px-3 py-2 text-right">Comentarios</th>
                <th className="px-3 py-2 text-right">Salvos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {posts.map((raw, index) => {
                const post = raw as Record<string, unknown>;
                const permalink = str(post.permalink);
                const caption = str(post.caption);
                const timestamp = str(post.timestamp);
                const reach = postMetricValue(post.insights, "reach");
                const likes = num(post.total_like_count) ?? postMetricValue(post.insights, "likes");
                const comments = num(post.total_comments_count) ?? postMetricValue(post.insights, "comments");
                const saved = num(post.saved_count) ?? postMetricValue(post.insights, "saved");

                return (
                  <tr key={str(post.id) ?? index} className="hover:bg-ink-50">
                    <td className="max-w-[240px] px-3 py-2">
                      {permalink ? (
                        <a
                          href={permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate font-medium text-ink-900 hover:text-accent hover:underline"
                        >
                          {caption ?? "Ver post"}
                        </a>
                      ) : (
                        <span className="block truncate text-ink-600">{caption ?? "—"}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-500">
                      {timestamp ? formatDateTime(timestamp) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {reach != null ? reach.toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {likes != null ? likes.toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {comments != null ? comments.toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                      {saved != null ? saved.toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink-500">Nenhum post encontrado no periodo.</p>
      )}

      <p className="text-xs text-ink-400">
        Gerado em {formatDateTime(report.completed_at ?? report.created_at)}
      </p>
    </div>
  );
}
