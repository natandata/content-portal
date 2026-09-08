"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";
import { STAFF_PRESENCE_CHANNEL } from "@/lib/realtime/presence";
import type { UserRole } from "@/types/database";

/**
 * Anuncia "estou online" enquanto esta pagina do staff estiver aberta --
 * montado uma vez em `WorkspaceShell`, entao cobre toda tela de
 * profissional/admin. Sai da lista sozinho quando a aba fecha ou perde
 * conexao (o Realtime dispara `leave` no disconnect do websocket, sem
 * precisar de heartbeat manual nem expiracao por tempo).
 *
 * `presence.key: userId` faz varias abas da mesma pessoa contarem como uma
 * so entrada na lista (mesmo padrao de dedupe que a chave dá de graca).
 */
export function PresenceTracker({
  userId,
  name,
  role,
}: {
  userId: string;
  name: string;
  role: UserRole;
}) {
  useEffect(() => {
    if (role !== "admin" && role !== "professional") return;

    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;

      channel = supabase.channel(STAFF_PRESENCE_CHANNEL, {
        config: { presence: { key: userId } },
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && channel) {
          void channel.track({ userId, name, role, onlineAt: new Date().toISOString() });
        }
      });
    }

    void start();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, name, role]);

  return null;
}
