"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botao discreto para buscar a versao mais nova do app. Limpa o cache de
 * assets do service worker (so ele guarda algo — paginas e API nunca passam
 * por cache, ver public/sw.js) e recarrega. Sem o service worker, ou sem
 * suporte a Cache API, ainda assim recarrega: o reload sozinho ja busca HTML
 * e RSC novos da rede.
 */
export function ReloadAppButton({ label }: { label: string }) {
  const [spinning, setSpinning] = useState(false);

  async function reload() {
    setSpinning(true);
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // Sem suporte ou sem permissao — o reload abaixo ainda ajuda.
    } finally {
      window.location.reload();
    }
  }

  return (
    <IconButton label={label} onClick={() => void reload()} disabled={spinning}>
      <RefreshCw className={cn("size-4", spinning && "animate-spin")} />
    </IconButton>
  );
}
