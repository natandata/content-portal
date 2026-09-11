import "server-only";

import { apifyConfig, appBaseUrl } from "@/lib/env";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const INSTAGRAM_PROFILE_ACTOR = "apify/instagram-profile-scraper";

async function apifyFetch(path: string, init?: RequestInit): Promise<Result<unknown>> {
  const config = apifyConfig();
  if (!config) return { ok: false, error: "Apify nao configurada nesta instalacao." };

  const response = await fetch(`https://api.apify.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, error: `Apify respondeu ${response.status}: ${body.slice(0, 200)}` };
  }

  return { ok: true, data: await response.json() };
}

/**
 * Dispara o ator de perfil publico do Instagram (sem login — o input nao
 * tem campo de senha nenhum). O `reportId` vai embutido na URL do webhook:
 * assim a rota que recebe a conclusao acha a linha certa direto pelo id
 * dela, sem depender de casar pelo `actorRunId` que a Apify manda de volta
 * (formato do payload de webhook nao documentado com precisao — mais
 * confiavel embutir a propria chave do que tentar parsear a resposta deles).
 */
export async function runInstagramProfileScraper(
  reportId: string,
  username: string,
): Promise<Result<{ runId: string }>> {
  const config = apifyConfig();
  if (!config) return { ok: false, error: "Apify nao configurada nesta instalacao." };

  const webhookUrl = `${appBaseUrl()}/api/webhooks/apify?token=${encodeURIComponent(config.webhookSecret)}&reportId=${encodeURIComponent(reportId)}`;

  const webhooks = [
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
      requestUrl: webhookUrl,
    },
  ];
  const encodedWebhooks = Buffer.from(JSON.stringify(webhooks)).toString("base64");
  const actorPath = INSTAGRAM_PROFILE_ACTOR.replace("/", "~");

  const result = await apifyFetch(`/acts/${actorPath}/runs?webhooks=${encodeURIComponent(encodedWebhooks)}`, {
    method: "POST",
    body: JSON.stringify({ usernames: [username] }),
  });
  if (!result.ok) return result;

  const data = result.data as { data: { id: string } };
  return { ok: true, data: { runId: data.data.id } };
}

/** Status e dataset de um run — usado pelo webhook para confirmar a conclusao antes de ler os dados. */
export async function fetchApifyRun(
  runId: string,
): Promise<Result<{ status: string; datasetId: string | null }>> {
  const result = await apifyFetch(`/actor-runs/${runId}`);
  if (!result.ok) return result;

  const data = result.data as { data: { status: string; defaultDatasetId?: string } };
  return { ok: true, data: { status: data.data.status, datasetId: data.data.defaultDatasetId ?? null } };
}

/** `clean=true` tira metadados internos da Apify, so os campos do resultado de verdade. */
export async function fetchDatasetItems(datasetId: string): Promise<Result<unknown[]>> {
  const result = await apifyFetch(`/datasets/${datasetId}/items?clean=true`);
  if (!result.ok) return result;
  return { ok: true, data: result.data as unknown[] };
}
