import "server-only";

/**
 * Leitura defensiva do formato cru que a Composio/Graph API devolve pros
 * insights do Instagram -- usado tanto no PDF (`instagram-insights-pdf.tsx`)
 * quanto na previa em tela (`instagram-insights-report-card.tsx`), pra nao
 * duplicar (e divergir) a mesma logica de parsing em dois lugares.
 *
 * Nao e client-safe de proposito (`server-only`) -- hoje so e usado por
 * componentes de servidor, mas nada aqui depende de secret nenhum; o import
 * e so pra pegar erro cedo se algum dia alguem tentar puxar isso pro client.
 */

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Uma serie de metrica (`period=day`): `{ data: [{ name, values: [{ value, end_time? }] }] }`. */
export function metricSeries(raw: unknown, name: string): { value: number; endTime: string | null }[] {
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

export function metricTotal(raw: unknown, name: string): number {
  return metricSeries(raw, name).reduce((sum, point) => sum + point.value, 0);
}

/** Insights de um post/story (`period=lifetime`): mesma forma, mas so um valor por metrica, sem `end_time`. */
export function postMetricValue(insights: unknown, name: string): number | null {
  if (!Array.isArray(insights)) return null;
  const entry = insights.find(
    (item) => item && typeof item === "object" && (item as { name?: unknown }).name === name,
  ) as { values?: { value?: unknown }[] } | undefined;
  return num(entry?.values?.[0]?.value);
}

/**
 * Demografia (`metric_type=total_value`, um `breakdown` por chamada) --
 * forma documentada da Graph API e `data[0].total_value.breakdowns[0].results[]`,
 * cada resultado com `dimension_values` (array, normalmente 1 item) e
 * `value`. Nunca testado contra uma resposta real nesta instalacao (conta de
 * teste nao tinha demografia disponivel) -- por isso tenta tambem a forma de
 * serie (`values[]`) como fallback antes de desistir, em vez de so supor.
 */
export function extractDemographicsEntries(raw: unknown): { label: string; value: number }[] {
  if (!raw || typeof raw !== "object") return [];
  const data = Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  const entry = data[0] as Record<string, unknown> | undefined;
  if (!entry) return [];

  const totalValue = entry.total_value as { breakdowns?: unknown[] } | undefined;
  const firstBreakdown = totalValue?.breakdowns?.[0] as { results?: unknown[] } | undefined;
  if (Array.isArray(firstBreakdown?.results)) {
    return firstBreakdown.results
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
      .map((r) => {
        const dims = r.dimension_values;
        const label = Array.isArray(dims) ? dims.map(String).join(", ") : str(dims) ?? "—";
        return { label, value: num(r.value) ?? 0 };
      })
      .sort((a, b) => b.value - a.value);
  }

  if (Array.isArray(entry.values)) {
    return entry.values
      .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
      .map((v, index) => ({ label: str(v.dimension) ?? `#${index + 1}`, value: num(v.value) ?? 0 }));
  }

  return [];
}
