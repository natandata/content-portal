"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Ouve mudancas nas tabelas informadas e pede uma nova renderizacao quando
 * algo muda — sem isso, quem ja estava com a pagina aberta so via a
 * atualizacao na proxima navegacao.
 *
 * Duas pegadinhas resolvidas aqui, confirmadas testando manualmente:
 * - Sem `realtime.setAuth(token)` explicito, o client do browser (via
 *   `@supabase/ssr`, sessao chega por cookie) nunca propaga o JWT para o
 *   modulo Realtime, e a assinatura fica "conectada" mas nunca entrega
 *   evento nenhum — mesmo com a sessao valida.
 * - O parametro `filter` do Postgres Changes nao funciona combinado com uma
 *   sessao autenticada (RLS) neste projeto (com service role funciona; com
 *   sessao real, nunca entrega). Por isso aqui NAO se usa `filter`: ouve a
 *   tabela inteira e deixa o RLS (can_view_client) decidir quem recebe o
 *   qu — confirmado que cliente A nao recebe evento de dado do cliente B.
 *
 * O canal so avisa que algo mudou; o RSC busca os dados de novo sob a
 * mesma RLS de sempre, entao nada sensivel trafega pelo canal.
 */
export function RealtimeRefresh({ channelKey, tables }: { channelKey: string; tables: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 400);
    };

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;

      channel = supabase.channel(`refresh-${channelKey}`);
      for (const table of tables.split(",")) {
        channel.on(
          "postgres_changes" as never,
          { event: "*", schema: "public", table: table.trim() },
          refresh,
        );
      }
      channel.subscribe();
    }

    void start();

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (channel) void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, tables]);

  return null;
}
