import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { checkConnectionStatus } from "@/lib/composio/client";
import { INSTAGRAM_CONNECT_COOKIE } from "@/lib/composio/constants";
import { appBaseUrl } from "@/lib/env";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Volta do fluxo de conexao Instagram da Composio. Mesmo desenho das rotas
 * de callback do Google/Calendly, mas mais simples: a Composio hospeda ela
 * mesma o vai-e-volta OAuth com a Meta e so devolve `status=success|failed`
 * (contrato documentado em `connectedAccounts.link()`, ver
 * node_modules/@composio/core/src/types/connectedAccounts.types.ts) — sem
 * `code` para trocar aqui. O `connectionId` que precisamos para confirmar e
 * gravar veio guardado num cookie de curta duracao, setado ao iniciar
 * (`startInstagramConnectAction`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const status = url.searchParams.get("status");

  const store = await cookies();
  const connectionId = store.get(INSTAGRAM_CONNECT_COOKIE)?.value;
  store.delete(INSTAGRAM_CONNECT_COOKIE);

  const back = (query: string) =>
    NextResponse.redirect(
      `${appBaseUrl()}/professional/reports${clientId ? `?client=${clientId}&` : "?"}${query}`,
    );

  if (status !== "success") return back("error=instagram_denied");
  if (!clientId || !connectionId) return back("error=instagram_invalid_state");

  const actor = await requireStaff().catch(() => null);
  if (!actor) return back("error=instagram_session");

  const statusResult = await checkConnectionStatus(connectionId);
  if (!statusResult.ok || statusResult.data.status !== "ACTIVE") {
    return back("error=instagram_exchange_failed");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("client_instagram_connections").upsert(
    {
      client_id: clientId,
      composio_connection_id: connectionId,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );

  if (error) return back("error=instagram_save_failed");

  return back("done=instagram");
}
