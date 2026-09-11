import "server-only";

import { readFileSync, statSync } from "node:fs";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const API_BASE = "https://generativelanguage.googleapis.com";

/**
 * Cliente REST cru da API do Gemini (Files API + generateContent) -- mesmo
 * padrao sem SDK ja usado no resto do app (Mercado Pago, Focus NFe, etc.).
 * Uso duplo: transcrever o audio de um video baixado (`transcribeVideo`) e
 * reescrever esse texto pra evitar plagio literal (`rewriteText`). So o
 * worker do Railway usa este arquivo -- vídeos passam por aqui, nunca pela
 * Vercel.
 */

export interface GeminiFile {
  name: string;
  uri: string;
  state: string;
}

/**
 * Upload resumable -- o video inteiro vai pra memoria (`readFileSync`) antes
 * de subir. Ok pra clipes curtos de rede social (poucos MB a algumas
 * dezenas de MB); um video de horas passaria do razoavel pra memoria de um
 * worker pequeno, mas nao e o caso de uso aqui (posts/reels/tiktoks).
 */
async function uploadFile(apiKey: string, filePath: string, mimeType: string): Promise<Result<GeminiFile>> {
  try {
    const bytes = readFileSync(filePath);
    const numBytes = statSync(filePath).size;

    const startResponse = await fetch(`${API_BASE}/upload/v1beta/files`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(numBytes),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: `content-portal-${Date.now()}` } }),
    });

    if (!startResponse.ok) {
      const body = await startResponse.text().catch(() => "");
      return { ok: false, error: `Gemini (upload start) respondeu ${startResponse.status}: ${body.slice(0, 200)}` };
    }

    const uploadUrl = startResponse.headers.get("x-goog-upload-url");
    if (!uploadUrl) return { ok: false, error: "Gemini nao devolveu a URL de upload." };

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(numBytes),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: bytes,
    });

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text().catch(() => "");
      return { ok: false, error: `Gemini (upload) respondeu ${uploadResponse.status}: ${body.slice(0, 200)}` };
    }

    const json = (await uploadResponse.json()) as { file: { name: string; uri: string; state: string } };
    return { ok: true, data: { name: json.file.name, uri: json.file.uri, state: json.file.state } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao subir o video pro Gemini." };
  }
}

/** Video precisa ser processado (estado ACTIVE) antes de poder ser referenciado num prompt. */
async function waitForActive(apiKey: string, name: string, maxAttempts = 60): Promise<Result<null>> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${API_BASE}/v1beta/${name}`, { headers: { "x-goog-api-key": apiKey } });
    if (!response.ok) return { ok: false, error: `Gemini (status do arquivo) respondeu ${response.status}.` };

    const json = (await response.json()) as { state: string };
    if (json.state === "ACTIVE") return { ok: true, data: null };
    if (json.state === "FAILED") return { ok: false, error: "O processamento do video falhou no Gemini." };

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { ok: false, error: "O Gemini demorou demais pra processar o video." };
}

async function deleteFile(apiKey: string, name: string): Promise<void> {
  await fetch(`${API_BASE}/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": apiKey } }).catch(
    () => {},
  );
}

async function generateContent(
  apiKey: string,
  model: string,
  parts: Record<string, unknown>[],
): Promise<Result<string>> {
  const response = await fetch(`${API_BASE}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
  });

  const json = (await response.json().catch(() => null)) as
    | { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } }
    | null;

  if (!response.ok) {
    return { ok: false, error: json?.error?.message ?? `Gemini respondeu ${response.status}.` };
  }

  const text = json?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!text) return { ok: false, error: "O Gemini nao devolveu texto nenhum." };
  return { ok: true, data: text.trim() };
}

/**
 * Baixa (ja feito por quem chama) -> sobe -> espera processar -> transcreve
 * -> apaga o arquivo no Gemini (expira em 48h de qualquer forma, mas nao
 * precisa esperar). Mesmo prompt da skill `transcript` original.
 */
export async function transcribeVideo(
  apiKey: string,
  filePath: string,
  mimeType: string,
  model = "gemini-2.5-flash",
): Promise<Result<string>> {
  const uploaded = await uploadFile(apiKey, filePath, mimeType);
  if (!uploaded.ok) return uploaded;

  const ready = await waitForActive(apiKey, uploaded.data.name);
  if (!ready.ok) {
    await deleteFile(apiKey, uploaded.data.name);
    return ready;
  }

  const result = await generateContent(apiKey, model, [
    { file_data: { mime_type: mimeType, file_uri: uploaded.data.uri } },
    {
      text: "Transcreva integralmente o audio deste video, em portugues (ou no idioma original, se nao for portugues), incluindo timestamps aproximados a cada mudanca relevante de fala ou cena.",
    },
  ]);

  await deleteFile(apiKey, uploaded.data.name);
  return result;
}

const REWRITE_SYSTEM_PROMPT = `Voce reescreve transcricoes de video com outras palavras, pra nao ser
consideradas copia literal/plagio. Regras:
- Mantenha a mesma estrutura, ordem das ideias e informacoes -- nao invente
  nada novo e nao corte pontos importantes.
- Troque vocabulario, ordem de frases e forma de dizer, mas preserve o
  sentido e o tom (se e falado/informal, continue informal).
- Ignore timestamps -- devolva so o texto corrido, sem marcacoes de tempo.
- Devolva SOMENTE o texto reescrito, sem comentario nenhum antes ou depois.`;

/** Reescreve a transcricao com outras palavras (texto puro, sem video). */
export async function rewriteText(
  apiKey: string,
  transcript: string,
  model = "gemini-2.5-flash",
): Promise<Result<string>> {
  return generateContent(apiKey, model, [{ text: `${REWRITE_SYSTEM_PROMPT}\n\nTranscricao original:\n${transcript}` }]);
}
