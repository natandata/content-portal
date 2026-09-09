import "server-only";

import { renderInstagramInsightsPdf } from "@/server/reports/instagram-insights-pdf";
import { contractPath, BUCKETS } from "@/lib/paths";
import { sendPushToClientStaff } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InstagramInsightsReportRow } from "@/types/database";

/**
 * Gera o PDF do relatorio de insights e entrega em Documentos (tabela
 * `contracts`, mesmo bucket/fluxo dos documentos que a equipe ja envia --
 * ganha preview, download assinado e a tela de Documentos de graca). Chamado
 * tanto pelo disparo manual quanto pelo cron automatico.
 *
 * Nasce `client_visible: false` / `status: 'pending_delivery'` -- o envio ao
 * cliente nunca e automatico, so quando o profissional clicar em "Enviar ao
 * cliente" (`sendDocumentToClientAction`). Aqui so avisa a EQUIPE que ha um
 * relatorio novo esperando revisao.
 *
 * Melhor esforco de proposito: o relatorio em si (`instagram_insights_reports`)
 * ja foi salvo com sucesso antes desta funcao rodar -- uma falha aqui (PDF ou
 * Storage) nunca deve derrubar o relatorio que a pessoa ja pode ver na tela.
 */
export async function deliverInstagramInsightsReportPdf(params: {
  clientId: string;
  report: InstagramInsightsReportRow;
  requestedBy: string | null;
}): Promise<void> {
  const admin = createAdminClient();

  // Grava o motivo real da falha na propria linha do relatorio -- alem do
  // console.error, pra ser diagnosticavel mesmo sem acesso aos logs da
  // Vercel (temporario, ver plano; nunca mostrado ao usuario).
  async function recordDeliveryError(message: string) {
    await admin.from("instagram_insights_reports").update({ delivery_error: message.slice(0, 2000) }).eq("id", params.report.id);
  }

  try {
    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("company_name")
      .eq("id", params.clientId)
      .maybeSingle();
    if (!client) {
      const message = `cliente nao encontrado: ${clientError?.message ?? "sem erro"}`;
      console.error("[instagram-report-delivery]", message, params.clientId);
      await recordDeliveryError(message);
      return;
    }

    const pdfBuffer = await renderInstagramInsightsPdf({
      companyName: client.company_name,
      report: params.report,
    });

    const generatedAt = new Date(params.report.completed_at ?? params.report.created_at);
    const accountLabel = params.report.instagram_username ? ` [@${params.report.instagram_username}]` : "";
    const title = `Relatorio de Instagram${accountLabel} (${params.report.period_months} meses) - ${generatedAt.toLocaleDateString("pt-BR")}`;

    const { data: document, error: insertError } = await admin
      .from("contracts")
      .insert({
        client_id: params.clientId,
        title,
        kind: "report",
        requires_signature: false,
        allow_gov_br_signature: false,
        client_visible: false,
        status: "pending_delivery",
        created_by: params.requestedBy,
      })
      .select("id")
      .single();
    if (insertError || !document) {
      const message = `falha ao criar o documento: ${insertError?.message ?? "sem erro"} ${insertError?.details ?? ""} ${insertError?.hint ?? ""}`;
      console.error("[instagram-report-delivery]", message);
      await recordDeliveryError(message);
      return;
    }

    const filePath = contractPath(params.clientId, document.id, "relatorio-instagram.pdf");
    const { error: uploadError } = await admin.storage.from(BUCKETS.contracts).upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) {
      const message = `falha ao enviar o PDF pro storage: ${uploadError.message}`;
      console.error("[instagram-report-delivery]", message);
      await recordDeliveryError(message);
      return;
    }

    await admin
      .from("contracts")
      .update({ original_file_path: filePath, uploaded_at: new Date().toISOString() })
      .eq("id", document.id);

    await sendPushToClientStaff(params.clientId, {
      title: "Relatorio pronto para envio",
      body: `"${title}" foi gerado e esta aguardando voce enviar ao cliente.`,
      url: "/professional/documents",
      tag: `document-${document.id}`,
    }).catch(() => {});
  } catch (error) {
    // Melhor esforco -- ver comentario da funcao -- mas nunca mais silencioso.
    const message = `falha inesperada: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
    console.error("[instagram-report-delivery]", message);
    await recordDeliveryError(message).catch(() => {});
  }
}
