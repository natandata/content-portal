"use client";

import { useEffect } from "react";

import { recordContentViewedAction } from "@/server/actions/content-views";

/**
 * Sem UI nenhuma -- so dispara o registro da primeira visualizacao do
 * cliente ao abrir a tela do conteudo. Mesmo padrao de `markChatReadAction`
 * em `chat-thread.tsx` (Server Action disparada por `useEffect` no mount).
 * O historico so mostra a linha nova num proximo refresh/reload da pagina
 * (nao vale a pena um `router.refresh()` aqui so pra isso).
 */
export function TrackContentView({ contentId }: { contentId: string }) {
  useEffect(() => {
    void recordContentViewedAction(contentId);
  }, [contentId]);

  return null;
}
