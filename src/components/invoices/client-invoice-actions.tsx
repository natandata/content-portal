"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const done = await copyText(value);
        if (!done) {
          toast.error("Nao foi possivel copiar. Copie manualmente.");
          return;
        }
        setCopied(true);
        toast.success("Copiado.");
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 text-sm font-medium text-on-ink transition hover:bg-ink-800"
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copiado!" : label}
    </button>
  );
}

export function ClientBoletoDownload({
  url,
  label = "Baixar boleto",
  unavailableLabel = "Boleto ainda nao disponivel",
}: {
  url: string | null;
  label?: string;
  unavailableLabel?: string;
}) {
  if (!url) return <p className="text-sm text-ink-500">{unavailableLabel}</p>;
  return (
    <a
      href={url}
      className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 text-sm font-medium text-on-ink transition hover:bg-ink-800"
    >
      <Download className="size-4" aria-hidden />
      {label}
    </a>
  );
}

export function ClientCopyLink({ link, label = "Copiar link" }: { link: string; label?: string }) {
  return <CopyButton value={link} label={label} />;
}

export function ClientCopyPixKey({ pixKey, label = "Copiar chave Pix" }: { pixKey: string; label?: string }) {
  return <CopyButton value={pixKey} label={label} />;
}
