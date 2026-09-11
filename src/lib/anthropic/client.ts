import "server-only";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/**
 * Cliente REST cru da API da Anthropic (sem SDK -- mesmo padrao sem
 * dependencia extra ja usado pro Autentique/Mercado Pago/Focus NFe).
 * Usado pra sugerir legenda/roteiro de conteudo assistido por IA.
 */
export async function complete(
  apiKey: string,
  params: { system: string; prompt: string; maxTokens?: number },
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
        messages: [{ role: "user", content: params.prompt }],
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
