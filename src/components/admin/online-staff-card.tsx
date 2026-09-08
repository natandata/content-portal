"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/ui/feedback";
import { Card, CardHeader } from "@/components/ui/layout";
import { ROLE_LABEL } from "@/lib/domain";
import { STAFF_PRESENCE_CHANNEL, type StaffPresence } from "@/lib/realtime/presence";
import { createClient } from "@/lib/supabase/client";

/**
 * Le o mesmo canal de presenca que `PresenceTracker` escreve -- so
 * escuta, nunca chama `track()` (o admin nao precisa aparecer na propria
 * lista so por estar olhando o dashboard, embora acabe aparecendo mesmo
 * assim se ele tambem estiver numa outra aba do workspace, que ai sim
 * anuncia via WorkspaceShell).
 */
export function OnlineStaffCard() {
  const [online, setOnline] = useState<StaffPresence[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    function readState() {
      if (!channel) return;
      const state = channel.presenceState<StaffPresence>();
      const people: StaffPresence[] = Object.values(state)
        .map((entries) => entries[0])
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .map((entry) => ({ userId: entry.userId, name: entry.name, role: entry.role, onlineAt: entry.onlineAt }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setOnline(people);
    }

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;

      channel = supabase.channel(STAFF_PRESENCE_CHANNEL);
      channel
        .on("presence", { event: "sync" }, readState)
        .on("presence", { event: "join" }, readState)
        .on("presence", { event: "leave" }, readState)
        .subscribe();
    }

    void start();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card>
      <CardHeader
        title="Online agora"
        description={online.length === 0 ? "Ninguem da equipe conectado no momento." : `${online.length} conectado(s)`}
      />
      {online.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Ninguem online"
          description="Assim que alguem da equipe abrir o app, aparece aqui em tempo real."
        />
      ) : (
        <ul className="space-y-2.5">
          {online.map((person) => (
            <li key={person.userId} className="flex items-center gap-2.5 text-sm">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-medium text-ink-900">{person.name}</span>
              <span className="text-xs text-ink-400">{ROLE_LABEL[person.role]}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
