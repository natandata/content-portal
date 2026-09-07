import { AlertTriangle, Loader2 } from "lucide-react";

import { Sparkline } from "@/components/ui/sparkline";
import {
  extractDemographicsEntries,
  metricSeries,
  metricTotal,
  num,
  postMetricValue,
  str,
} from "@/lib/instagram-insights";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { InstagramInsightsReportRow } from "@/types/database";

function instagramSparklineLabel(point: { value: number; endTime: string | null }): string {
  return `${point.endTime ? formatDate(point.endTime.slice(0, 10)) : ""}: ${point.value.toLocaleString("pt-BR")}`;
}

const AUDIENCE_DIMENSION_LABEL: Record<string, string> = {
  age: "Idade",
  gender: "Genero",
  city: "Cidade",
  country: "Pais",
};

/** Uma dimensao de audiencia (ex.: pais) como barrinhas -- so as 5 maiores, pra nao virar uma lista infinita. */
function AudienceBars({ dimension, entries }: { dimension: string; entries: { label: string; value: number }[] }) {
  const top = entries.slice(0, 5);
  const max = Math.max(...top.map((e) => e.value), 1);

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
        {AUDIENCE_DIMENSION_LABEL[dimension] ?? dimension}
      </p>
      {top.length === 0 ? (
        <p className="mt-1 text-xs text-ink-400">Sem dados suficientes.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {top.map((entry) => (
            <li key={entry.label} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 truncate text-ink-600">{entry.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                <span
                  className="block h-full rounded-full bg-accent/70"
                  style={{ width: `${Math.max((entry.value / max) * 100, 4)}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums text-ink-500">
                {entry.value.toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Relatorio de insights (relatorio 2). `account_metrics`/`posts`/`stories`/
 * `audience` vem crus da Composio (jsonb, jeito Graph API) -- leitura
 * defensiva via `src/lib/instagram-insights.ts`, so guardado cru no banco.
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
  const stories = Array.isArray(report.stories) ? report.stories : [];
  const audience = (report.audience ?? {}) as Record<string, unknown>;
  const audienceDimensions = Object.keys(audience);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Alcance no periodo ({metricTotal(report.account_metrics, "reach").toLocaleString("pt-BR")})
          </p>
          <Sparkline points={reachSeries} formatLabel={instagramSparklineLabel} />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Interacoes no periodo ({metricTotal(report.account_metrics, "total_interactions").toLocaleString("pt-BR")})
          </p>
          <Sparkline points={interactionsSeries} formatLabel={instagramSparklineLabel} />
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

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
          Stories ativos agora {stories.length > 0 ? `(${stories.length})` : ""}
        </p>
        {stories.length === 0 ? (
          <p className="text-sm text-ink-500">
            Nenhum story ativo no momento da geracao -- a Meta so mostra stories dentro das 24h, nunca historico.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((raw, index) => {
              const story = raw as Record<string, unknown>;
              const timestamp = str(story.timestamp);
              const views = num(story.view_count) ?? postMetricValue(story.insights, "views");
              const reach = postMetricValue(story.insights, "reach");
              const replies = postMetricValue(story.insights, "replies");

              return (
                <li key={str(story.id) ?? index} className="rounded-lg border border-line p-2.5 text-xs">
                  <p className="text-ink-500">{timestamp ? formatDateTime(timestamp) : "—"}</p>
                  <p className="mt-1 tabular-nums text-ink-700">
                    {views != null ? `${views.toLocaleString("pt-BR")} views` : "—"} ·{" "}
                    {reach != null ? `${reach.toLocaleString("pt-BR")} alcance` : "—"}
                    {replies != null ? ` · ${replies.toLocaleString("pt-BR")} respostas` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">Publico (perfil atual)</p>
        {audienceDimensions.length === 0 ? (
          <p className="text-sm text-ink-500">
            Demografia indisponivel -- pode exigir mais seguidores ou nao ter sido liberada pela Meta pra esta conta.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {audienceDimensions.map((dimension) => (
              <AudienceBars key={dimension} dimension={dimension} entries={extractDemographicsEntries(audience[dimension])} />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-ink-400">
        Gerado em {formatDateTime(report.completed_at ?? report.created_at)}
      </p>
    </div>
  );
}
