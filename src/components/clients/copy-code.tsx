"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/** Botao para copiar o codigo de acesso e enviar ao cliente. */
export function CopyCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Codigo copiado.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nao foi possivel copiar. Selecione o codigo manualmente.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        "focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5",
        "font-mono text-sm tracking-[0.18em] text-ink-800 transition hover:bg-ink-50",
        className,
      )}
      aria-label={`Copiar codigo ${code}`}
    >
      {code}
      {copied ? (
        <Check className="size-3.5 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="size-3.5 text-ink-400" aria-hidden />
      )}
    </button>
  );
}
