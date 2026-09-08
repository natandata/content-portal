import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { callInstagramTool, checkConnectionStatus } from "@/lib/composio/client";
import { INSTAGRAM_CONNECT_COOKIE } from "@/lib/composio/constants";
import { appBaseUrl } from "@/lib/env";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";

/**
 * Volta do fluxo de conexao Instagram da Composio. Mesmo desenho das rotas
 * de callback do Google/Calendly, mas mais simples: a Composio hospeda ela
 * mesma o vai-e-volta OAuth com a Meta e so devolve `status=success|failed`
 * (contrato documentado em `connectedAccounts.link()`, ver
 * node_modules/@composio/core/src/types/connectedAccounts.types.ts) — sem
 * `code` para trocar aqui. O `connectionId`/`label` que precisamos para
 * confirmar e gravar vieram guardados num cookie de curta duracao, setado ao
 * iniciar (`startInstagramConnectAction`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const status = url.searchParams.get("status");

  const store = await cookies();
  const rawCookie = store.get(INSTAGRAM_CONNECT_COOKIE)?.value;
  store.delete(INSTAGRAM_CONNECT_COOKIE);

  const cookiePayload = (() => {
    if (!rawCookie) return null;
    try {
      const parsed = JSON.parse(rawCookie) as { connectionId?: string; label?: string | null };
      return parsed.connectionId ? { connectionId: parsed.connectionId, label: parsed.label ?? null } : null;
    } catch {
      return null;
    }
  })();

  const back = (query: string) =>
    NextResponse.redirect(
      `${appBaseUrl()}/professional/reports${clientId ? `?client=${clientId}&` : "?"}${query}`,
    );

  if (status !== "success") return back("error=instagram_denied");
  if (!clientId || !cookiePayload) return back("error=instagram_invalid_state");

  const actor = await requireStaff().catch(() => null);
  if (!actor) return back("error=instagram_session");

  const statusResult = await checkConnectionStatus(cookiePayload.connectionId);
  if (!statusResult.ok || statusResult.data.status !== "ACTIVE") {
    return back("error=instagram_exchange_failed");
  }

  const admin = createAdminClient();

  // Melhor esforco -- busca o username real da conta pra mostrar na lista
  // (o rotulo digitado e opcional, e sem isso duas contas apareceriam iguais
  // como "Conta conectada", facil de conectar a mesma duas vezes sem notar).
  const userInfoResult = await callInstagramTool(
    clientId,
    cookiePayload.connectionId,
    "INSTAGRAM_GET_USER_INFO",
    {},
  );
  const instagramUsername = userInfoResult.ok
    ? (() => {
        const raw = userInfoResult.data as { username?: unknown; data?: { username?: unknown } };
        const username = raw.username ?? raw.data?.username;
        return typeof username === "string" && username.trim() ? username : null;
      })()
    : null;

  // A primeira conexao do cliente ja nasce principal -- as seguintes ficam
  // disponiveis para gerar relatorio na mao ate alguem trocar a principal.
  const { data: existing } = await admin
    .from("client_instagram_connections")
    .select("id")
    .eq("client_id", clientId);
  const isFirstConnection = !existing || existing.length === 0;

  const { error } = await admin.from("client_instagram_connections").insert({
    client_id: clientId,
    composio_connection_id: cookiePayload.connectionId,
    label: cookiePayload.label,
    instagram_username: instagramUsername,
    is_principal: isFirstConnection,
    // O escopo de publicacao e' do Auth Config da Composio (nao por
    // conexao) -- toda autorizacao NOVA feita depois do Auth Config ganhar
    // `instagram_business_content_publish` ja sai com o escopo. Se este
    // deploy for antes do Auth Config ser atualizado, reconexoes feitas
    // nesse intervalo vao mostrar `true` sem ter o escopo de verdade --
    // atualizar o Auth Config ANTES ou junto deste deploy.
    publish_scope_granted: true,
    connected_at: new Date().toISOString(),
  });

  if (error) return back("error=instagram_save_failed");

  await logClientActivity(
    admin,
    clientId,
    actor.displayName,
    `Conectou o Instagram${instagramUsername ? ` (@${instagramUsername})` : ""}`,
  );

  return back("done=instagram");
}
