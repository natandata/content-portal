"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { COVER_COLOR_KEYS, COVER_PALETTE, type CoverColorKey } from "@/lib/cover-palette";
import { cn } from "@/lib/utils";
import { updateClientCoverColorAction } from "@/server/actions/clients";

/**
 * Capa do cliente e so cor — sem upload de imagem. O card em Clientes usa o
 * mesmo degrade, entao a escolha aqui vale para os dois lugares.
 */
export function ClientCoverPicker({
  clientId,
  color,
  className,
}: {
  clientId: string;
  color: string;
  className?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(color);
  const [pending, start] = useTransition();

  function choose(key: CoverColorKey) {
    if (key === selected || pending) return;
    setSelected(key);
    start(async () => {
      const result = await updateClientCoverColorAction(clientId, key);
      if (!result.ok) {
        toast.error(result.error);
        setSelected(color);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div className={cn("size-full bg-gradient-to-br", COVER_PALETTE[selected as CoverColorKey]?.gradient)} />

      <div className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-ink-900/50 p-1.5 backdrop-blur">
        {COVER_COLOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => choose(key)}
            disabled={pending}
            aria-label={COVER_PALETTE[key].label}
            aria-pressed={selected === key}
            className={cn(
              "focus-ring flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br transition",
              COVER_PALETTE[key].gradient,
              selected === key ? "ring-2 ring-white" : "opacity-80 hover:opacity-100",
            )}
          >
            {selected === key ? <Check className="size-3.5 text-white drop-shadow" aria-hidden /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
