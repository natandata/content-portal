import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import {
  extractDemographicsEntries,
  metricTotal,
  num,
  postMetricValue,
  reelAvgWatchSeconds,
  reelRetentionPercent,
  str,
} from "@/lib/instagram-insights";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { InstagramInsightsReportRow } from "@/types/database";

const MAX_POSTS_IN_PDF = 20;
const MAX_STORIES_IN_PDF = 12;
const MAX_REELS_IN_PDF = 20;

const AUDIENCE_DIMENSION_LABEL: Record<string, string> = {
  age: "Idade",
  gender: "Genero",
  city: "Cidade",
  country: "Pais",
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 16 },
  brand: { fontSize: 9, color: "#888", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 11, color: "#555" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20, gap: 10 },
  statBox: {
    width: "23%",
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 4,
    padding: 8,
  },
  statValue: { fontSize: 15, fontWeight: 700 },
  statLabel: { fontSize: 8, color: "#666", marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 8, marginTop: 14 },
  sectionNote: { fontSize: 8, color: "#888", marginTop: -6, marginBottom: 8 },
  table: { borderWidth: 1, borderColor: "#e2e2e2", borderRadius: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f5f5f5", borderBottomWidth: 1, borderBottomColor: "#e2e2e2" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  cellPost: { width: "40%", padding: 6, fontSize: 8 },
  cellDate: { width: "16%", padding: 6, fontSize: 8 },
  cellNum: { width: "11%", padding: 6, fontSize: 8, textAlign: "right" },
  headerCell: { fontSize: 8, fontWeight: 700, color: "#555" },
  storyCard: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 4,
    padding: 6,
    marginRight: "1.5%",
    marginBottom: 8,
  },
  storyDate: { fontSize: 8, color: "#666" },
  storyMetric: { fontSize: 8, marginTop: 2 },
  audienceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  audienceBox: { width: "47%" },
  audienceRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 8, paddingVertical: 2 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999", textAlign: "center" },
});

function InstagramInsightsPdfDocument({
  companyName,
  report,
}: {
  companyName: string;
  report: InstagramInsightsReportRow;
}) {
  const posts = (Array.isArray(report.posts) ? report.posts : []).slice(0, MAX_POSTS_IN_PDF);
  const stories = (Array.isArray(report.stories) ? report.stories : []).slice(0, MAX_STORIES_IN_PDF);
  const audience = (report.audience ?? {}) as Record<string, unknown>;
  const audienceDimensions = Object.keys(audience);
  const profileSnapshot = (report.profile_snapshot ?? {}) as Record<string, unknown>;
  const allReels = (Array.isArray(report.posts) ? report.posts : []).filter(
    (raw) => (raw as Record<string, unknown>).media_product_type === "REELS",
  );
  const reels = allReels.slice(0, MAX_REELS_IN_PDF);

  const stats: { label: string; value: number }[] = [
    { label: "Alcance", value: metricTotal(report.account_metrics, "reach") },
    { label: "Interacoes", value: metricTotal(report.account_metrics, "total_interactions") },
    { label: "Contas engajadas", value: metricTotal(report.account_metrics, "accounts_engaged") },
    { label: "Curtidas", value: metricTotal(report.account_metrics, "likes") },
    { label: "Comentarios", value: metricTotal(report.account_metrics, "comments") },
    { label: "Compartilhamentos", value: metricTotal(report.account_metrics, "shares") },
    { label: "Salvamentos", value: metricTotal(report.account_metrics, "saves") },
    { label: "Respostas", value: metricTotal(report.account_metrics, "replies") },
    { label: "Visualizacoes", value: metricTotal(report.account_metrics, "views") },
    { label: "Visitas ao perfil", value: metricTotal(report.account_metrics, "profile_views") },
    { label: "Cliques no site", value: metricTotal(report.account_metrics, "website_clicks") },
    { label: "Seguidores atuais", value: num(profileSnapshot.followers_count) ?? 0 },
    { label: "Novos seguidores no periodo", value: metricTotal(report.account_metrics, "follower_count") },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Content Portal · Relatorio de Instagram</Text>
          <Text style={styles.title}>{companyName}</Text>
          <Text style={styles.subtitle}>
            Insights dos ultimos {report.period_months} meses -- gerado em {formatDateTime(report.completed_at ?? report.created_at)}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statBox}>
              <Text style={styles.statValue}>{stat.value.toLocaleString("pt-BR")}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.sectionNote}>
          Novos seguidores no periodo e o crescimento liquido (novos menos perdidos); Seguidores atuais e o total real
          de agora -- a Meta nao expõe o total historico de um dia especifico do passado.
        </Text>

        <Text style={styles.sectionTitle}>
          Posts do periodo {posts.length > 0 ? `(${posts.length}${posts.length === MAX_POSTS_IN_PDF ? "+" : ""})` : ""}
        </Text>

        {posts.length === 0 ? (
          <Text>Nenhum post encontrado no periodo.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.cellPost, styles.headerCell]}>Post</Text>
              <Text style={[styles.cellDate, styles.headerCell]}>Data</Text>
              <Text style={[styles.cellNum, styles.headerCell]}>Alcance</Text>
              <Text style={[styles.cellNum, styles.headerCell]}>Curtidas</Text>
              <Text style={[styles.cellNum, styles.headerCell]}>Coment.</Text>
              <Text style={[styles.cellNum, styles.headerCell]}>Salvos</Text>
            </View>
            {posts.map((raw, index) => {
              const post = raw as Record<string, unknown>;
              const caption = str(post.caption);
              const timestamp = str(post.timestamp);
              const reach = postMetricValue(post.insights, "reach");
              const likes = num(post.total_like_count) ?? postMetricValue(post.insights, "likes");
              const comments = num(post.total_comments_count) ?? postMetricValue(post.insights, "comments");
              const saved = num(post.saved_count) ?? postMetricValue(post.insights, "saved");

              return (
                <View key={str(post.id) ?? index} style={styles.tableRow}>
                  <Text style={styles.cellPost}>{(caption ?? "Sem legenda").slice(0, 90)}</Text>
                  <Text style={styles.cellDate}>{timestamp ? formatDate(timestamp.slice(0, 10)) : "-"}</Text>
                  <Text style={styles.cellNum}>{reach != null ? reach.toLocaleString("pt-BR") : "-"}</Text>
                  <Text style={styles.cellNum}>{likes != null ? likes.toLocaleString("pt-BR") : "-"}</Text>
                  <Text style={styles.cellNum}>{comments != null ? comments.toLocaleString("pt-BR") : "-"}</Text>
                  <Text style={styles.cellNum}>{saved != null ? saved.toLocaleString("pt-BR") : "-"}</Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>
          Retencao de Reels {allReels.length > 0 ? `(${allReels.length}${allReels.length === MAX_REELS_IN_PDF ? "+" : ""})` : ""}
        </Text>
        <Text style={styles.sectionNote}>
          Retencao nos 3s iniciais (100% - taxa de abandono da Meta) -- a Meta nao expõe a curva completa de retencao.
        </Text>

        {reels.length === 0 ? (
          <Text>Nenhum Reel no periodo.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.cellPost, styles.headerCell]}>Reel</Text>
              <Text style={[styles.cellDate, styles.headerCell]}>Data</Text>
              <Text style={[styles.cellNum, styles.headerCell]}>Retencao (3s)</Text>
              <Text style={[styles.cellNum, styles.headerCell]}>Tempo assistido</Text>
            </View>
            {reels.map((raw, index) => {
              const post = raw as Record<string, unknown>;
              const caption = str(post.caption);
              const timestamp = str(post.timestamp);
              const retention = reelRetentionPercent(post.insights);
              const watchSeconds = reelAvgWatchSeconds(post.insights);

              return (
                <View key={str(post.id) ?? index} style={styles.tableRow}>
                  <Text style={styles.cellPost}>{(caption ?? "Sem legenda").slice(0, 90)}</Text>
                  <Text style={styles.cellDate}>{timestamp ? formatDate(timestamp.slice(0, 10)) : "-"}</Text>
                  <Text style={styles.cellNum}>{retention != null ? `${retention.toFixed(1)}%` : "-"}</Text>
                  <Text style={styles.cellNum}>{watchSeconds != null ? `${watchSeconds.toFixed(1)}s` : "-"}</Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>Stories ativos agora {stories.length > 0 ? `(${stories.length})` : ""}</Text>
        <Text style={styles.sectionNote}>
          A Meta so devolve stories dentro das 24h -- nunca historico do periodo do relatorio.
        </Text>

        {stories.length === 0 ? (
          <Text>Nenhum story ativo no momento da geracao.</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {stories.map((raw, index) => {
              const story = raw as Record<string, unknown>;
              const timestamp = str(story.timestamp);
              const views = num(story.view_count) ?? postMetricValue(story.insights, "views");
              const reach = postMetricValue(story.insights, "reach");
              const replies = postMetricValue(story.insights, "replies");

              return (
                <View key={str(story.id) ?? index} style={styles.storyCard}>
                  <Text style={styles.storyDate}>{timestamp ? formatDateTime(timestamp) : "-"}</Text>
                  <Text style={styles.storyMetric}>Views: {views != null ? views.toLocaleString("pt-BR") : "-"}</Text>
                  <Text style={styles.storyMetric}>Alcance: {reach != null ? reach.toLocaleString("pt-BR") : "-"}</Text>
                  <Text style={styles.storyMetric}>
                    Respostas: {replies != null ? replies.toLocaleString("pt-BR") : "-"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>Publico (perfil atual)</Text>
        <Text style={styles.sectionNote}>
          Retrato de agora (semana/mes atual) -- a Meta nao libera demografia historica do periodo do relatorio.
        </Text>

        {audienceDimensions.length === 0 ? (
          <Text>Demografia indisponivel para esta conta no momento.</Text>
        ) : (
          <View style={styles.audienceGrid}>
            {audienceDimensions.map((dimension) => {
              const entries = extractDemographicsEntries(audience[dimension]).slice(0, 6);
              return (
                <View key={dimension} style={styles.audienceBox}>
                  <Text style={[styles.headerCell, { marginBottom: 4 }]}>
                    {AUDIENCE_DIMENSION_LABEL[dimension] ?? dimension}
                  </Text>
                  {entries.length === 0 ? (
                    <Text style={{ fontSize: 8, color: "#888" }}>Sem dados suficientes.</Text>
                  ) : (
                    entries.map((entry) => (
                      <View key={entry.label} style={styles.audienceRow}>
                        <Text>{entry.label}</Text>
                        <Text>{entry.value.toLocaleString("pt-BR")}</Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        )}

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
