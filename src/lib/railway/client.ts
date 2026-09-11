import "server-only";

import { railwayTriggerConfig } from "@/lib/env";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const GRAPHQL_URL = "https://backboard.railway.com/graphql/v2";

/**
 * Dispara uma nova execucao do worker de transcricao no Railway --
 * `serviceInstanceRedeploy` reroda o ultimo deploy (a mesma imagem/comando
 * ja publicados), o que basta aqui porque o worker e um script "roda e
 * termina" (le as linhas `pending` e sai), nao um servidor. Sem polling: so
 * dispara quando alguem clica em "Gerar" -- e assim que fica praticamente
 * sem custo (Railway cobra por segundo de execucao, nao por estar ligado).
 */
export async function triggerReferenceTranscribeWorker(): Promise<Result<null>> {
  const config = railwayTriggerConfig();
  if (!config) return { ok: false, error: "Transcricao ainda nao foi configurada nesta instalacao (Railway)." };

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Project-Access-Token": config.projectToken,
      },
      body: JSON.stringify({
        query: `mutation ServiceInstanceRedeploy($serviceId: String!, $environmentId: String!) {
          serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
        }`,
        variables: { serviceId: config.serviceId, environmentId: config.environmentId },
      }),
    });

    const json = (await response.json().catch(() => null)) as
      | { errors?: { message?: string }[]; data?: { serviceInstanceRedeploy?: boolean } }
      | null;

    if (!response.ok || json?.errors?.length) {
      const message = json?.errors?.[0]?.message ?? `Railway respondeu ${response.status}.`;
      return { ok: false, error: message };
    }
    if (!json?.data?.serviceInstanceRedeploy) {
      return { ok: false, error: "Railway nao confirmou o disparo do worker." };
    }

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao falar com o Railway." };
  }
}
