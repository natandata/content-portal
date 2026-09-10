import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { metricTotal, num } from "@/lib/instagram-insights";
import {
  buildDisparityAlertText,
  buildRetentionCalloutText,
  findBestRetentionReel,
  findClickDisparity,
  topAudienceSegment,
} from "@/lib/instagram-insights-narrative";
import { formatDateTime } from "@/lib/utils";
import type { InstagramInsightsReportRow } from "@/types/database";

/**
 * Relatorio estrategico, nao mais um expositor de tabela crua: Raio-X do
 * Perfil (stats + alerta de descompasso + destaque de maior retencao),
 * Arquitetura de Canal (sugestoes de bio/link/destaques), Arquitetura de
 * Conteudo (retencao + dicas de gancho) e Funil de Conteudo (topo/meio/fundo).
 * Paleta Slate/Blue/Emerald deliberadamente diferente do tema do app --
 * pedido especifico do usuario pra este relatorio.
 *
 * `@react-pdf/renderer` nao suporta box-shadow nem gradiente real -- o
 * visual aqui usa cor solida + borda + borderRadius, aproximacao aceita
 * (ver plano de sessao) ate uma eventual migracao pra HTML/headless-browser
 * se um dia quisermos fidelidade total ao mockup.
 */

const COLOR = {
  slate900: "#0f172a",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  blue700: "#1d4ed8",
  blue600: "#2563eb",
  blue100: "#dbeafe",
  blue50: "#eff6ff",
  amber900: "#78350f",
  amber800: "#92400e",
  amber300: "#fcd34d",
  amber50: "#fffbeb",
  emerald900: "#064e3b",
  emerald800: "#065f46",
  emerald600: "#059669",
  emerald300: "#6ee7b7",
  emerald50: "#ecfdf5",
};

const styles = StyleSheet.create({
  page: { fontSize: 9.5, fontFamily: "Helvetica", color: COLOR.slate900 },
  header: { backgroundColor: COLOR.slate900, padding: 28, paddingBottom: 22 },
  brand: { fontSize: 9, color: COLOR.blue100, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  companyName: { fontSize: 20, fontWeight: 700, color: COLOR.white, marginBottom: 3 },
  handle: { fontSize: 10, color: COLOR.slate300 },
  periodBox: { position: "absolute", top: 28, right: 28, alignItems: "flex-end" },
  periodLabel: { fontSize: 8, color: COLOR.slate400, textTransform: "uppercase" },
  periodValue: { fontSize: 10, fontWeight: 700, color: COLOR.white, marginTop: 2 },
  generatedAt: { fontSize: 8, color: COLOR.slate400, marginTop: 6 },

  body: { padding: 28, paddingTop: 22 },
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  eyebrow: { fontSize: 8, fontWeight: 700, color: COLOR.blue700, backgroundColor: COLOR.blue50, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: COLOR.slate900 },
  sectionLede: { fontSize: 9, color: COLOR.slate500, marginBottom: 12, maxWidth: "85%", lineHeight: 1.4 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  statBox: { width: "23%", borderWidth: 1, borderColor: COLOR.slate200, borderRadius: 6, padding: 8 },
  statValue: { fontSize: 14, fontWeight: 700, color: COLOR.slate900 },
  statLabel: { fontSize: 7.5, color: COLOR.slate500, marginTop: 2 },

  calloutBox: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  calloutTitle: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  calloutText: { fontSize: 9, lineHeight: 1.45 },

  cardRow: { flexDirection: "row", gap: 8 },
  card: { flex: 1, borderWidth: 1, borderColor: COLOR.slate200, borderRadius: 8, padding: 10 },
  cardTitle: { fontSize: 9.5, fontWeight: 700, color: COLOR.slate900, marginBottom: 4 },
  cardText: { fontSize: 8, color: COLOR.slate500, lineHeight: 1.4 },

  metricPair: { flexDirection: "row", gap: 8, marginBottom: 8 },
  metricCard: { flex: 1, borderWidth: 1, borderColor: COLOR.slate200, borderRadius: 8, padding: 10 },
  metricCardLabel: { fontSize: 7.5, color: COLOR.slate400, textTransform: "uppercase", marginBottom: 4 },
  metricCardValue: { fontSize: 18, fontWeight: 700, color: COLOR.slate900 },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: COLOR.slate100, marginTop: 6, marginBottom: 3 },
  barFill: { height: 5, borderRadius: 3, backgroundColor: COLOR.blue600 },
  metricCardNote: { fontSize: 7.5, color: COLOR.slate400 },

  tipsBox: { borderWidth: 1, borderColor: COLOR.slate200, borderRadius: 8, padding: 10 },
  tipRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  tipArrow: { fontSize: 9, fontWeight: 700, color: COLOR.blue600 },
  tipText: { fontSize: 8.5, color: COLOR.slate700, lineHeight: 1.4, flex: 1 },

  funnelStage: { borderWidth: 1, borderColor: COLOR.slate200, padding: 12 },
  funnelRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  funnelTag: { fontSize: 8, fontWeight: 700, width: 44 },
  funnelName: { fontSize: 10, fontWeight: 700, color: COLOR.slate900 },
  funnelSub: { fontSize: 7.5, color: COLOR.slate500, marginTop: 1 },
  funnelMetricLabel: { fontSize: 7, color: COLOR.slate400, textTransform: "uppercase" },
  funnelMetricValue: { fontSize: 9.5, fontWeight: 700, color: COLOR.slate700, marginTop: 1 },
  funnelAction: { fontSize: 7.5, color: COLOR.slate600, lineHeight: 1.3 },

  footer: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 7.5, color: COLOR.slate400, textAlign: "center" },
});

function fmt(value: number): string {
  return value.toLocaleString("pt-BR");
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{fmt(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InstagramInsightsPdfDocument({
  companyName,
  report,
}: {
  companyName: string;
  report: InstagramInsightsReportRow;
}) {
  const posts = Array.isArray(report.posts) ? report.posts : [];
  const audience = (report.audience ?? {}) as Record<string, unknown>;
  const profileSnapshot = (report.profile_snapshot ?? {}) as Record<string, unknown>;

  const reach = metricTotal(report.account_metrics, "reach");
  const views = metricTotal(report.account_metrics, "views");
  const profileViews = metricTotal(report.account_metrics, "profile_views");
  const newFollowers = metricTotal(report.account_metrics, "follower_count");
  const interactions = metricTotal(report.account_metrics, "total_interactions");
  const saves = metricTotal(report.account_metrics, "saves");
  const shares = metricTotal(report.account_metrics, "shares");
  const comments = metricTotal(report.account_metrics, "comments");
  const websiteClicks = metricTotal(report.account_metrics, "website_clicks");
  const currentFollowers = num(profileSnapshot.followers_count) ?? 0;

  const disparity = findClickDisparity(report.account_metrics);
  const bestReel = findBestRetentionReel(posts);
  const segment = topAudienceSegment(audience);
  const hasSegment = Boolean(segment.genderLabel || segment.ageLabel);

  const contentTips: string[] = [];
  if (bestReel) {
    contentTips.push(
      "Gancho no primeiro segundo. O Reel que deu certo abre com o resultado, nao com explicacao. Copia essa formula nos proximos roteiros.",
    );
    contentTips.push(
      "Coloca a chamada pra acao ainda dentro do trecho de maior atencao do video, nao so guardada pro final.",
    );
  }
  if (hasSegment) {
    const who = [segment.genderLabel, segment.ageLabel].filter(Boolean).join(", ");
    const cityPart = segment.cityLabel ? `, maioria em ${segment.cityLabel}` : "";
    contentTips.push(`Seu publico e ${who}${cityPart}. Fala a lingua dele: direto, sem jargao tecnico.`);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Content Portal · Relatorio de Instagram</Text>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.handle}>
            {report.instagram_username ? `@${report.instagram_username}` : "Conta nao identificada"} · Instagram
          </Text>
          <View style={styles.periodBox}>
            <Text style={styles.periodLabel}>Periodo analisado</Text>
            <Text style={styles.periodValue}>Ultimos {report.period_months} meses</Text>
            <Text style={styles.generatedAt}>
              Gerado em {formatDateTime(report.completed_at ?? report.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* ===================== 01 — RAIO-X DO PERFIL ===================== */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.eyebrow}>01</Text>
              <Text style={styles.sectionTitle}>Raio-X do Perfil</Text>
            </View>
            <Text style={styles.sectionLede}>Onde voce esta agora. E daqui que a gente parte.</Text>

            <View style={styles.statGrid}>
              <StatBox label="Alcance" value={reach} />
              <StatBox label="Visualizacoes" value={views} />
              <StatBox label="Visitas ao perfil" value={profileViews} />
              <StatBox label="Novos seguidores" value={newFollowers} />
              <StatBox label="Interacoes" value={interactions} />
              <StatBox label="Salvamentos" value={saves} />
              <StatBox label="Compartilhamentos" value={shares} />
              <StatBox label="Seguidores atuais" value={currentFollowers} />
            </View>

            {disparity ? (
              <View style={[styles.calloutBox, { backgroundColor: COLOR.amber50, borderColor: COLOR.amber300 }]}>
                <Text style={[styles.calloutTitle, { color: COLOR.amber900 }]}>Alcance otimo. Conversao quase zero.</Text>
                <Text style={[styles.calloutText, { color: COLOR.amber800 }]}>{buildDisparityAlertText(disparity)}</Text>
              </View>
            ) : null}

            {bestReel ? (
              <View style={[styles.calloutBox, { backgroundColor: COLOR.emerald50, borderColor: COLOR.emerald300 }]}>
                <Text style={[styles.calloutTitle, { color: COLOR.emerald900 }]}>O Reel que funcionou de verdade</Text>
                {bestReel.caption ? (
                  <Text style={[styles.calloutText, { color: COLOR.emerald800, fontWeight: 700, marginBottom: 3 }]}>
                    &ldquo;{bestReel.caption.slice(0, 100)}&rdquo;
                  </Text>
                ) : null}
                <Text style={[styles.calloutText, { color: COLOR.emerald800 }]}>{buildRetentionCalloutText(bestReel)}</Text>
              </View>
            ) : null}
          </View>

          {/* ===================== 02 — ARQUITETURA DE CANAL ===================== */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.eyebrow}>02</Text>
              <Text style={styles.sectionTitle}>Arquitetura de Canal</Text>
            </View>
            <Text style={styles.sectionLede}>
              {disparity
                ? "Alcance nao e o problema, ja vimos isso. O problema e o que vem depois. Tres ajustes no perfil, na ordem que mais pesam."
                : "O alcance esta convertendo dentro do esperado. Esses tres ajustes deixam o caminho ate o site ainda mais curto."}
            </Text>

            <View style={styles.cardRow}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Bio sem promessa</Text>
                <Text style={styles.cardText}>
                  Troca a descricao do servico por um resultado concreto (&ldquo;Cachos definidos em 1
                  sessao&rdquo;) e bota uma seta apontando pro link. Quem sabe o que ganha, clica.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Um link so nao basta</Text>
                <Text style={styles.cardText}>
                  Link generico obriga a pessoa a adivinhar. Um Linktree/Carrd com destinos claros (agendar,
                  ver antes/depois, WhatsApp) reduz a decisao.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Destaques sem ordem</Text>
                <Text style={styles.cardText}>
                  Organiza numa sequencia que convence: depoimento, como funciona, preco, duvidas. Cada um
                  fechando com uma chamada pra acao.
                </Text>
              </View>
            </View>
          </View>

          {/* ===================== 03 — ARQUITETURA DE CONTEUDO ===================== */}
          <View style={styles.section} wrap={false}>
            <View style={styles.sectionHead}>
              <Text style={styles.eyebrow}>03</Text>
              <Text style={styles.sectionTitle}>Arquitetura de Conteudo</Text>
            </View>

            {bestReel ? (
              <>
                <Text style={styles.sectionLede}>
                  Por que aquele Reel prendeu atencao — e como repetir isso de proposito, nao por acaso.
                </Text>

                <View style={styles.metricPair}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricCardLabel}>Retencao nos 3s iniciais</Text>
                    <Text style={styles.metricCardValue}>{bestReel.retention.toFixed(0)}%</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min(100, bestReel.retention)}%` }]} />
                    </View>
                    <Text style={styles.metricCardNote}>Media da conta: {bestReel.accountAvgRetention.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricCardLabel}>Tempo medio assistido</Text>
                    <Text style={styles.metricCardValue}>
                      {bestReel.watchSeconds != null ? `${bestReel.watchSeconds.toFixed(1)}s` : "—"}
                    </Text>
                    <Text style={[styles.metricCardNote, { marginTop: 9 }]}>No Reel de maior retencao do periodo</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.sectionLede}>Nenhum Reel com dado de retencao suficiente neste periodo.</Text>
            )}

            {contentTips.length > 0 ? (
              <View style={styles.tipsBox}>
                {contentTips.map((tip, index) => (
                  <View key={index} style={[styles.tipRow, index === contentTips.length - 1 ? { marginBottom: 0 } : undefined]}>
                    <Text style={styles.tipArrow}>{">"}</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* ===================== 04 — FUNIL DE CONTEUDO ===================== */}
          <View style={styles.section} wrap={false}>
            <View style={styles.sectionHead}>
              <Text style={styles.eyebrow}>04</Text>
              <Text style={styles.sectionTitle}>Funil de Conteudo</Text>
            </View>
            <Text style={styles.sectionLede}>
              Cada etapa pede um conteudo diferente. Misturar as tres no mesmo post e o motivo mais comum de
              alcance alto e venda baixa.
            </Text>

            <View style={[styles.funnelStage, { backgroundColor: COLOR.slate50, borderTopLeftRadius: 8, borderTopRightRadius: 8 }]}>
              <View style={styles.funnelRow}>
                <Text style={[styles.funnelTag, { color: COLOR.slate500 }]}>TOPO</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.funnelName}>Publico frio</Text>
                  <Text style={styles.funnelSub}>Nunca ouviu falar de voce</Text>
                </View>
                <View style={{ width: 90 }}>
                  <Text style={styles.funnelMetricLabel}>Alcance</Text>
                  <Text style={styles.funnelMetricValue}>{fmt(reach)}</Text>
                </View>
                <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: COLOR.slate200, paddingLeft: 10 }}>
                  <Text style={styles.funnelMetricLabel}>Acao</Text>
                  <Text style={styles.funnelAction}>Reel com gancho forte. Tendencia. Conteudo que ensina algo rapido.</Text>
                </View>
              </View>
            </View>

            <View style={[styles.funnelStage, { backgroundColor: COLOR.blue50, borderColor: COLOR.slate200 }]}>
              <View style={styles.funnelRow}>
                <Text style={[styles.funnelTag, { color: COLOR.blue700 }]}>MEIO</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.funnelName}>Audiencia</Text>
                  <Text style={styles.funnelSub}>Ja viu. Ta avaliando</Text>
                </View>
                <View style={{ width: 90 }}>
                  <Text style={styles.funnelMetricLabel}>Salvos + coment.</Text>
                  <Text style={styles.funnelMetricValue}>{fmt(saves + comments)}</Text>
                </View>
                <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: COLOR.blue100, paddingLeft: 10 }}>
                  <Text style={styles.funnelMetricLabel}>Acao</Text>
                  <Text style={styles.funnelAction}>Bastidor. Prova social. Antes e depois. Enquete pra puxar conversa.</Text>
                </View>
              </View>
            </View>

            <View style={[styles.funnelStage, { backgroundColor: COLOR.emerald50, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }]}>
              <View style={styles.funnelRow}>
                <Text style={[styles.funnelTag, { color: COLOR.emerald800 }]}>FUNDO</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.funnelName}>Comunidade</Text>
                  <Text style={styles.funnelSub}>Pronta pra comprar</Text>
                </View>
                <View style={{ width: 90 }}>
                  <Text style={styles.funnelMetricLabel}>Cliques no site</Text>
                  <Text style={styles.funnelMetricValue}>{fmt(websiteClicks)}</Text>
                </View>
                <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: COLOR.emerald300, paddingLeft: 10 }}>
                  <Text style={styles.funnelMetricLabel}>Acao</Text>
                  <Text style={styles.funnelAction}>CTA direto. Depoimento em video. Oferta com prazo.</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Gerado automaticamente pelo Content Portal
        </Text>
      </Page>
    </Document>
  );
}

/** Renderiza o PDF do relatorio de insights em memoria -- usado tanto no disparo manual quanto no cron automatico. */
export async function renderInstagramInsightsPdf(params: {
  companyName: string;
  report: InstagramInsightsReportRow;
}): Promise<Buffer> {
  return renderToBuffer(<InstagramInsightsPdfDocument companyName={params.companyName} report={params.report} />);
}
