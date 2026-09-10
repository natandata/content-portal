import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { checkConnectionStatus } from "@/lib/composio/client";
import { SOCIAL_CONNECT_COOKIE } from "@/lib/composio/social-constants";
import { getLinkedInAuthor } from "@/lib/composio/social-publish";
import { requireStaff } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import type { SocialPlatform } from "@/types/database";

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

/**
 * Volta do fluxo de conexao de uma rede social (alem do Instagram, que tem
 * sua propria rota) -- mesmo desenho de `api/auth/composio/callback`,
 * generico por plataforma.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const status = url.searchParams.get("status");

  const store = await cookies();
  const rawCookie = store.get(SOCIAL_CONNECT_COOKIE)?.value;
  store.delete(SOCIAL_CONNECT_COOKIE);

  const cookiePayload = (() => {
    if (!rawCookie) return null;
    try {
      const parsed = JSON.parse(rawCookie) as { connectionId?: string; platform?: SocialPlatform; label?: string | null };
      return parsed.connectionId && parsed.platform
        ? { connectionId: parsed.connectionId, platform: parsed.platform, label: parsed.label ?? null }
        : null;
    } catch {
      return null;
    }
  })();

  const back = (query: string) =>
    NextResponse.redirect(`${appBaseUrl()}/professional/clients${clientId ? `/${clientId}?` : "?"}${query}`);

  if (status !== "success") return back("error=social_denied");
  if (!clientId || !cookiePayload) return back("error=social_invalid_state");

  const actor = await requireStaff().catch(() => null);
  if (!actor) return back("error=social_session");

  const statusResult = await checkConnectionStatus(cookiePayload.connectionId);
  if (!statusResult.ok || statusResult.data.status !== "ACTIVE") {
    return back("error=social_exchange_failed");
  }

  const admin = createAdminClient();
  const { platform, connectionId, label } = cookiePayload;

  const { data: inserted, error } = await admin
    .from("client_social_connections")
    .insert({
      client_id: clientId,
      platform,
      composio_connection_id: connectionId,
      label,
      connected_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !inserted) return back("error=social_save_failed");

  // LinkedIn precisa do URN do autor antes de qualquer post -- resolve na
  // hora (best-effort, staff pode tentar de novo pela tela se falhar).
  if (platform === "linkedin") {
    const author = await getLinkedInAuthor(clientId, connectionId);
    if (author.ok) {
      await admin
        .from("client_social_connections")
        .update({ platform_data: { authorUrn: author.data.urn, authorName: author.data.name } })
        .eq("id", inserted.id);
    }
  }

  await logClientActivity(
    admin,
    clientId,
    actor.displayName,
    `Conectou o ${PLATFORM_LABEL[platform]}${label ? ` (${label})` : ""}`,
  );

  return back(`done=${platform}`);
}
