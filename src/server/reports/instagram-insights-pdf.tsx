import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatDate, formatDateTime } from "@/lib/utils";
import type { InstagramInsightsReportRow } from "@/types/database";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Mesma leitura defensiva de `InstagramInsightsReportCard` -- a Graph API embrulha series em `{data:[{name,values:[...]}]}`. */
function metricTotal(raw: unknown, name: string): number {
  const data =
    raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : [];
  const entry = data.find(
    (item) => item && typeof item === "object" && (item as { name?: unknown }).name === name,
  ) as { values?: { value?: unknown }[] } | undefined;

  return (entry?.values ?? []).reduce((sum, point) => sum + (num(point?.value) ?? 0), 0);
}

function postMetricValue(insights: unknown, name: string): number | null {
  if (!Array.isArray(insights)) return null;
  const entry = insights.find(
    (item) => item && typeof item === "object" && (item as { name?: unknown }).name === name,
  ) as { values?: { value?: unknown }[] } | undefined;
  return num(entry?.values?.[0]?.value);
}

const MAX_POSTS_IN_PDF = 20;

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
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 8, marginTop: 4 },
  table: { borderWidth: 1, borderColor: "#e2e2e2", borderRadius: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f5f5f5", borderBottomWidth: 1, borderBottomColor: "#e2e2e2" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  cellPost: { width: "40%", padding: 6, fontSize: 8 },
  cellDate: { width: "16%", padding: 6, fontSize: 8 },
  cellNum: { width: "11%", padding: 6, fontSize: 8, textAlign: "right" },
  headerCell: { fontSize: 8, fontWeight: 700, color: "#555" },
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

  const stats: { label: string; value: number }[] = [
    { label: "Alcance", value: metricTotal(report.account_metrics, "reach") },
    { label: "Interacoes", value: metricTotal(report.account_metrics, "total_interactions") },
    { label: "Curtidas", value: metricTotal(report.account_metrics, "likes") },
    { label: "Comentarios", value: metricTotal(report.account_metrics, "comments") },
    { label: "Compartilhamentos", value: metricTotal(report.account_metrics, "shares") },
    { label: "Salvamentos", value: metricTotal(report.account_metrics, "saves") },
    { label: "Visitas ao perfil", value: metricTotal(report.account_metrics, "profile_views") },
    { label: "Seguidores", value: metricTotal(report.account_metrics, "follower_count") },
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
