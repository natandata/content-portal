"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";

import { ReferenceTranscriptionRetryButton } from "@/components/reference-transcriptions/reference-transcription-retry-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/layout";
import { formatDateTime } from "@/lib/utils";
import type { BadgeTone } from "@/lib/domain";
import type { ClientReferenceTranscriptionRow, ClientReferenceTranscriptionStatus } from "@/types/database";

const STATUS_LABEL: Record<ClientReferenceTranscriptionStatus, string> = {
  pending: "Na fila",
  processing: "Baixando e transcrevendo...",
  done: "Concluida",
  failed: "Falhou",
};

const STATUS_TONE: Record<ClientReferenceTranscriptionStatus, BadgeTone> = {
  pending: "neutral",
  processing: "info",
  done: "success",
  failed: "danger",
};

export function ReferenceTranscriptionList({
  transcriptions,
  referenceTitles,
}: {
  transcriptions: ClientReferenceTranscriptionRow[];
  /** reference_id -> titulo, pra nao precisar buscar de novo por linha. */
  referenceTitles: Map<string, string>;
}) {
  if (transcriptions.length === 0) return null;

  return (
    <div className="space-y-3">
      {transcriptions.map((transcription) => (
        <TranscriptionCard
          key={transcription.id}
          transcription={transcription}
          title={referenceTitles.get(transcription.reference_id) ?? "Link removido do Banco de Referencias"}
        />
      ))}
    </div>
  );
}

function TranscriptionCard({
  transcription,
  title,
}: {
  transcription: ClientReferenceTranscriptionRow;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">{title}</p>
          <p className="text-xs text-ink-500">{formatDateTime(transcription.created_at)}</p>
        </div>
        <Badge tone={STATUS_TONE[transcription.status]}>{STATUS_LABEL[transcription.status]}</Badge>
      </div>

      {transcription.status === "failed" ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{transcription.error}</p>
          <ReferenceTranscriptionRetryButton transcriptionId={transcription.id} />
        </div>
      ) : null}

      {transcription.status === "done" && transcription.rewritten_text ? (
        <div className="mt-3 space-y-3">
          <TextBlock label="Texto reescrito" text={transcription.rewritten_text} />

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="focus-ring flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-800"
          >
            {expanded ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            {expanded ? "Esconder transcricao original" : "Ver transcricao original"}
          </button>

          {expanded && transcription.transcript ? <TextBlock label="Transcricao original" text={transcription.transcript} muted /> : null}
        </div>
      ) : null}
    </Card>
  );
}

function TextBlock({ label, text, muted }: { label: string; text: string; muted?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nao foi possivel copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <div className={muted ? "rounded-lg border border-line bg-ink-50/60 p-3" : "rounded-lg border border-line p-3"}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="focus-ring flex items-center gap-1 text-xs font-medium text-accent"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          Copiar
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink-800">{text}</p>
    </div>
  );
}
