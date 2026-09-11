import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { rewriteText, transcribeVideo } from "../../src/lib/gemini/client";
import { createAdminClient } from "../../src/lib/supabase/admin";

const execFileAsync = promisify(execFile);

// yt-dlp e baixado como binario estatico no Build Command do Railway pra
// dentro de worker/dist (ver Configuracoes do servico), junto do .mjs
// empacotado -- evita precisar de Python no container. Em dev local, cai
// pro `yt-dlp` do PATH se o binario nao estiver ao lado do script.
const HERE = fileURLToPath(new URL(".", import.meta.url));
const BUNDLED_YT_DLP = join(HERE, "yt-dlp");
const YT_DLP_BIN = existsSync(BUNDLED_YT_DLP) ? BUNDLED_YT_DLP : "yt-dlp";

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

async function downloadVideo(url: string, tmpDir: string): Promise<{ path: string; mimeType: string }> {
  const outputTemplate = join(tmpDir, "video.%(ext)s");
  await execFileAsync(YT_DLP_BIN, ["-f", "mp4/best", "--no-playlist", "-o", outputTemplate, url], {
    maxBuffer: 1024 * 1024 * 32,
  });

  const downloaded = readdirSync(tmpDir).find((name) => name.startsWith("video."));
  if (!downloaded) throw new Error("yt-dlp rodou mas nenhum arquivo foi encontrado.");

  const extension = downloaded.split(".").pop() ?? "mp4";
  const mimeType = MIME_BY_EXTENSION[extension] ?? "video/mp4";
  return { path: join(tmpDir, downloaded), mimeType };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY nao configurada neste servico do Railway.");

  const admin = createAdminClient();

  // Reivindica as linhas pendentes antes de processar -- se o worker for
  // disparado duas vezes quase junto, o segundo run nao pega as mesmas
  // linhas do primeiro (UPDATE...WHERE status = 'pending' e atomico).
  const { data: claimed, error: claimError } = await admin
    .from("client_reference_transcriptions")
    .update({ status: "processing" })
    .eq("status", "pending")
    .select("id, reference_id");
  if (claimError) throw new Error(claimError.message);

  if (!claimed || claimed.length === 0) {
    console.log("[reference-transcribe] nada pendente.");
    return;
  }

  console.log(`[reference-transcribe] processando ${claimed.length} linha(s).`);
  let done = 0;
  let failed = 0;

  for (const row of claimed) {
    const tmpDir = mkdtempSync(join(tmpdir(), "reference-transcribe-"));
    try {
      const { data: reference } = await admin
        .from("client_references")
        .select("url")
        .eq("id", row.reference_id)
        .maybeSingle();
      if (!reference) throw new Error("Link nao encontrado no Banco de Referencias (pode ter sido removido).");

      const { path: videoPath, mimeType } = await downloadVideo(reference.url, tmpDir);

      const transcribed = await transcribeVideo(apiKey, videoPath, mimeType);
      if (!transcribed.ok) throw new Error(transcribed.error);

      const rewritten = await rewriteText(apiKey, transcribed.data);
      if (!rewritten.ok) throw new Error(rewritten.error);

      await admin
        .from("client_reference_transcriptions")
        .update({
          status: "done",
          transcript: transcribed.data,
          rewritten_text: rewritten.data,
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      done += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha desconhecida ao processar o video.";
      console.error(`[reference-transcribe] linha ${row.id} falhou:`, message);
      await admin
        .from("client_reference_transcriptions")
        .update({ status: "failed", error: message.slice(0, 500), completed_at: new Date().toISOString() })
        .eq("id", row.id);
      failed += 1;
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  console.log(`[reference-transcribe] concluido: done=${done} failed=${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[reference-transcribe] failed:", err);
    process.exit(1);
  });
