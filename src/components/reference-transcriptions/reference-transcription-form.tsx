"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { startReferenceTranscriptionAction } from "@/server/actions/reference-transcriptions";
import type { ClientReferenceRow } from "@/types/database";

/**
 * Lista com checkbox do Banco de Referencias pra escolher quais links
 * transcrever + reescrever nesta rodada. Sem selecao "todos automatico" de
 * proposito -- a equipe decide quais valem a pena processar.
 */
export function ReferenceTranscriptionForm({
  clientId,
  references,
}: {
  clientId: string;
  references: ClientReferenceRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (selected.size === 0) {
      setError("Selecione pelo menos 1 link.");
      return;
    }

    setBusy(true);
    try {
      const result = await startReferenceTranscriptionAction({
        clientId,
        referenceIds: Array.from(selected),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Transcricao iniciada -- acompanhe o status abaixo.");
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (references.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex max-h-64 flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {references.map((reference) => (
          <label
            key={reference.id}
            className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition hover:bg-ink-50/60"
          >
            <input
              type="checkbox"
              checked={selected.has(reference.id)}
              onChange={() => toggle(reference.id)}
              disabled={busy}
              className="mt-0.5 size-4 accent-ink-900"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink-900">{reference.title}</span>
              <span className="block truncate text-xs text-ink-500">{reference.url}</span>
            </span>
          </label>
        ))}
      </div>

      <FormError>{error}</FormError>

      <Button loading={busy} onClick={() => void submit()} disabled={selected.size === 0}>
        <Sparkles className="size-4" aria-hidden />
        Transcrever e reescrever ({selected.size})
      </Button>
    </div>
  );
}
