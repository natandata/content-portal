import "server-only";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/** Bloco de imagem ou documento (PDF) por URL -- confirmado contra a documentacao
 * atual da Anthropic que a Messages API busca a URL sozinha, sem precisar baixar
 * e converter pra base64 no nosso lado. */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "document"; source: { type: "url"; url: string } };

async function request(
  apiKey: string,
  params: { system: string; content: string | ContentBlock[]; maxTokens?: number },
): Promise<Result<string>> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: params.maxTokens ?? 600,
        system: params.system,
        messages: [{ role: "user", content: params.content }],
      }),
    });

    const json = (await response.json().catch(() => null)) as
      | { content?: { type: string; text?: string }[]; error?: { message?: string } }
      | null;

    if (!response.ok) {
      return { ok: false, error: json?.error?.message ?? `Anthropic respondeu ${response.status}.` };
    }

    const text = json?.content?.find((block) => block.type === "text")?.text;
    if (!text) return { ok: false, error: "A IA nao devolveu texto nenhum." };
    return { ok: true, data: text.trim() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao falar com a Anthropic." };
  }
}

/**
 * Cliente REST cru da API da Anthropic (sem SDK -- mesmo padrao sem
 * dependencia extra ja usado pro Autentique/Mercado Pago/Focus NFe).
 * Usado pra sugerir legenda/roteiro de conteudo assistido por IA.
 */
export function complete(
  apiKey: string,
  params: { system: string; prompt: string; maxTokens?: number },
): Promise<Result<string>> {
  return request(apiKey, { system: params.system, content: params.prompt, maxTokens: params.maxTokens });
}

/**
 * Variante multimodal -- aceita blocos de texto/imagem/documento (PDF) por
 * URL, usada pela geracao de ideias de conteudo (le o relatorio enviado e as
 * imagens dos posts de referencia). Blocos de imagem/documento vao SEMPRE
 * antes do texto que os referencia, mesma convencao da propria Anthropic.
 */
export function completeMultimodal(
  apiKey: string,
  params: { system: string; content: ContentBlock[]; maxTokens?: number },
): Promise<Result<string>> {
  return request(apiKey, { system: params.system, content: params.content, maxTokens: params.maxTokens });
}
