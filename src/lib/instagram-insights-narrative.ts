import "server-only";

import {
  extractDemographicsEntries,
  metricTotal,
  reelAvgWatchSeconds,
  reelRetentionPercent,
  str,
} from "@/lib/instagram-insights";

/**
 * Camada de "leitura estrategica" em cima dos dados crus do Instagram --
 * transforma numero em conclusao (qual conteudo prender mais atencao, se ha
 * descompasso entre alcance e clique, qual faixa de publico predomina).
 * Usado hoje so pelo PDF (`reports/instagram-insights-pdf.tsx`); escrito
 * sem nenhuma dependencia de react-pdf de proposito pra poder ser reusado
 * pela tela da equipe (`instagram-insights-report-card.tsx`) depois.
 */

export type ReelHighlight = {
  id: string | null;
  caption: string | null;
  timestamp: string | null;
  retention: number;
  watchSeconds: number | null;
  accountAvgRetention: number;
};

/**
 * O Reel com maior retencao nos 3s iniciais do periodo, junto da media da
 * conta pra dar contexto ("82% vs a media de 54%"). Null se nao houver Reel
 * com essa metrica disponivel -- a Meta so libera `reels_skip_rate` pra
 * Reels processados, alguns ficam sem.
 */
export function findBestRetentionReel(posts: unknown[]): ReelHighlight | null {
  const reels = (Array.isArray(posts) ? posts : [])
    .filter((raw) => (raw as Record<string, unknown>)?.media_product_type === "REELS")
    .map((raw) => {
      const post = raw as Record<string, unknown>;
      return {
        id: str(post.id),
        caption: str(post.caption),
        timestamp: str(post.timestamp),
        retention: reelRetentionPercent(post.insights),
        watchSeconds: reelAvgWatchSeconds(post.insights),
      };
    })
    .filter((reel): reel is typeof reel & { retention: number } => reel.retention != null);

  if (reels.length === 0) return null;

  const accountAvgRetention = reels.reduce((sum, r) => sum + r.retention, 0) / reels.length;
  const best = reels.reduce((top, r) => (r.retention > top.retention ? r : top));

  return { ...best, accountAvgRetention };
}

export type ClickDisparity = {
  reach: number;
  websiteClicks: number;
  ctr: number;
};

// Abaixo de 0,1% do alcance clicando pro site, com alcance relevante (>5000)
// pra nao disparar alerta em conta pequena onde 1 clique a mais already muda
// o percentual inteiro. Limiar de julgamento -- ajustar se a pratica mostrar
// outro numero mais util.
const DISPARITY_CTR_THRESHOLD = 0.001;
const DISPARITY_MIN_REACH = 5000;

/** Descompasso entre alcance e cliques no site -- null se nao houver alcance suficiente pra avaliar ou se a conversao estiver dentro do esperado. */
export function findClickDisparity(accountMetrics: unknown): ClickDisparity | null {
  const reach = metricTotal(accountMetrics, "reach");
  const websiteClicks = metricTotal(accountMetrics, "website_clicks");
  if (reach < DISPARITY_MIN_REACH) return null;

  const ctr = websiteClicks / reach;
  if (ctr >= DISPARITY_CTR_THRESHOLD) return null;

  return { reach, websiteClicks, ctr };
}

const GENDER_LABEL: Record<string, string> = {
  F: "mulheres",
  M: "homens",
  U: "publico nao especificado",
};

export type AudienceSegment = {
  genderLabel: string | null;
  ageLabel: string | null;
  cityLabel: string | null;
};

/** Recorte de publico predominante -- genero, faixa etaria e cidade mais fortes, cada um lido de forma independente (a Meta devolve cada dimensao numa chamada separada). */
export function topAudienceSegment(audience: Record<string, unknown>): AudienceSegment {
  const topOf = (dimension: string) => extractDemographicsEntries(audience[dimension])[0]?.label ?? null;

  const rawGender = topOf("gender");
  const genderLabel = rawGender ? (GENDER_LABEL[rawGender] ?? rawGender.toLowerCase()) : null;

  return {
    genderLabel,
    ageLabel: topOf("age"),
    cityLabel: topOf("city"),
  };
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatPercent(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Texto do alerta de descompasso alcance x clique, no tom de consultor (numeros reais embutidos). */
export function buildDisparityAlertText(d: ClickDisparity): string {
  return (
    `${formatNumber(d.reach)} contas alcancadas. So ${formatNumber(d.websiteClicks)} ${d.websiteClicks === 1 ? "clique foi parar" : "cliques foram parar"} ` +
    `no site -- ${formatPercent(d.ctr * 100)}% de conversao. O publico esta vendo. Nao e isso que falta. ` +
    `Falta caminho: ninguem sabe pra onde ir depois do post.`
  );
}

/** Texto do destaque de maior retencao, no mesmo tom. */
export function buildRetentionCalloutText(r: ReelHighlight): string {
  const watchPart =
    r.watchSeconds != null ? ` Tempo medio assistido: ${r.watchSeconds.toFixed(1)}s.` : "";
  return (
    `${r.retention.toFixed(0)}% de retencao nos 3s iniciais (a media da conta e ${r.accountAvgRetention.toFixed(0)}%).${watchPart} ` +
    `Isso nao foi sorte. Foi gancho.`
  );
}
