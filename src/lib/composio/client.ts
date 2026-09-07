import "server-only";

import { Composio } from "@composio/core";

import { composioConfig } from "@/lib/env";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

let cached: { key: string; instance: Composio } | null = null;

/**
 * Instancia unica por chave de API (evita recriar o client a cada chamada).
 * Se a chave mudar em runtime (troca de env sem redeploy), recria.
 */
function client(apiKey: string): Composio {
  if (!cached || cached.key !== apiKey) {
    cached = { key: apiKey, instance: new Composio({ apiKey }) };
  }
  return cached.instance;
}

/**
 * Inicia a conexao OAuth do Instagram Business/Creator de um cliente. O
 * `userId` da Composio e o proprio `client_id` do app -- assim nao precisa
 * de uma tabela extra so pra mapear "quem e esse usuario para a Composio".
 * Usa `connectedAccounts.link()` (nao `initiate()`, que a propria Composio
 * marca como descontinuado para OAuth gerenciado por ela -- ver comentario
 * de deprecacao no client instalado em node_modules/@composio/core).
 *
 * `allowMultiple: true` -- um cliente pode ter mais de uma conta Instagram
 * conectada (sem isso, a segunda tentativa para o mesmo `userId`+auth config
 * lanca `ComposioMultipleConnectedAccountsError`). `alias` precisa ser unico
 * por `userId`+toolkit no projeto -- o chamador gera um valor aleatorio a
 * cada tentativa (nunca deriva do rotulo digitado, pra nao arriscar colisao
 * com um alias de uma conexao antiga ja removida).
 */
export async function initiateInstagramConnection(
  clientId: string,
  callbackUrl: string,
  alias: string,
): Promise<Result<{ connectionId: string; redirectUrl: string }>> {
  const config = composioConfig();
  if (!config) return { ok: false, error: "Composio nao configurada nesta instalacao." };

  try {
    const request = await client(config.apiKey).connectedAccounts.link(
      clientId,
      config.instagramAuthConfigId,
      { callbackUrl, alias, allowMultiple: true },
    );
    if (!request.redirectUrl) {
      return { ok: false, error: "Composio nao devolveu um link de autorizacao." };
    }
    return { ok: true, data: { connectionId: request.id, redirectUrl: request.redirectUrl } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao iniciar conexao com o Instagram." };
  }
}

/** Status atual de uma conexao (`ACTIVE`, `INITIATED`, `FAILED`, etc.) -- usado pra saber se o cliente ja terminou o OAuth. */
export async function checkConnectionStatus(
  connectionId: string,
): Promise<Result<{ status: string; toolkitSlug: string }>> {
  const config = composioConfig();
  if (!config) return { ok: false, error: "Composio nao configurada nesta instalacao." };

  try {
    const account = await client(config.apiKey).connectedAccounts.get(connectionId);
    return { ok: true, data: { status: account.status, toolkitSlug: account.toolkit.slug } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao consultar a conexao." };
  }
}

/** Revoga a conexao -- usado no botao "Desconectar" do cartao do Instagram. */
export async function disconnectInstagramConnection(connectionId: string): Promise<Result<void>> {
  const config = composioConfig();
  if (!config) return { ok: false, error: "Composio nao configurada nesta instalacao." };

  try {
    await client(config.apiKey).connectedAccounts.delete(connectionId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao desconectar o Instagram." };
  }
}

/**
 * Wrapper generico por cima de `tools.execute()`, usado pelos tres tools do
 * toolkit Instagram (`INSTAGRAM_GET_USER_INSIGHTS`, `INSTAGRAM_GET_IG_USER_MEDIA`,
 * `INSTAGRAM_GET_IG_MEDIA_INSIGHTS`). `dangerouslySkipVersionCheck: true`
 * porque a etapa 4 chama isso muitas vezes numa mesma rota (paginacao de
 * posts) -- pular a checagem de versao evita uma chamada extra por tool.
 *
 * `connectedAccountId` desambigua qual das contas do cliente usar -- desde
 * que um cliente pode ter mais de uma conta conectada, `userId` sozinho nao
 * basta mais.
 */
export async function callInstagramTool(
  clientId: string,
  connectedAccountId: string,
  toolSlug: string,
  args: Record<string, unknown>,
): Promise<Result<Record<string, unknown>>> {
  const config = composioConfig();
  if (!config) return { ok: false, error: "Composio nao configurada nesta instalacao." };

  try {
    const result = await client(config.apiKey).tools.execute(toolSlug, {
      userId: clientId,
      connectedAccountId,
      arguments: args,
      dangerouslySkipVersionCheck: true,
    });
    if (!result.successful) {
      return { ok: false, error: result.error ?? `Falha ao executar ${toolSlug}.` };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Falha ao executar ${toolSlug}.` };
  }
}
