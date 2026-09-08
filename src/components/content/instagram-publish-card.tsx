"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CalendarPlus, CheckCircle2, ExternalLink, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import {
  cancelScheduledPublishAction,
  publishContentNowAction,
  scheduleContentPublishAction,
} from "@/server/actions/instagram-publish";
import type { InstagramConnectionStatus } from "@/server/actions/instagram-connect";
import type { ContentPublishStatus, ContentStatus, ContentType } from "@/types/database";
import { formatDate, formatDateTime } from "@/lib/utils";

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * Publicacao direta no Instagram (feed/carrossel) -- v1 nao cobre video
 * (Reels/Stories entram numa fase 2 de proposito). Mesma lingua visual do
 * agendamento de relatorios (`instagram-insights-report-form.tsx`): botao
 * de agora + toggle de agendar por data, so data sem hora.
 */
export function InstagramPublishCard({
  contentId,
  contentType,
  contentStatus,
  connections,
  instagramConnectionId,
  publishStatus,
  publishError,
  scheduledDate,
  instagramMediaId,
  publishedAt,
}: {
  contentId: string;
  contentType: ContentType;
  contentStatus: ContentStatus;
  connections: InstagramConnectionStatus[];
  instagramConnectionId: string | null;
  publishStatus: ContentPublishStatus;
  publishError: string | null;
  scheduledDate: string | null;
  instagramMediaId: string | null;
  publishedAt: string | null;
}) {
  const router = useRouter();
  const principal = connections.find((connection) => connection.isPrincipal) ?? connections[0];
  const [connectionId, setConnectionId] = useState(instagramConnectionId ?? principal?.id ?? "");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(scheduledDate ?? "");
  const [busy, setBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const selectedConnection = connections.find((connection) => connection.id === connectionId);
  const isApproved = contentStatus === "approved";

  if (contentType === "video") {
    return (
      <p className="text-sm text-ink-500">
        Publicacao direta de video ainda nao esta disponivel -- Reels entra numa fase 2. Use &quot;Marcar como
        publicado&quot; depois de postar na mao.
      </p>
    );
  }

  if (connections.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        Conecte o Instagram do cliente na tela de Relatorios antes de publicar direto por aqui.
      </p>
    );
  }

  if (publishStatus === "published") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p>Publicado no Instagram{publishedAt ? ` em ${formatDateTime(publishedAt)}` : ""}.</p>
          {instagramMediaId ? (
            <a
              href={`https://www.instagram.com/p/${instagramMediaId}/`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
            >
              <ExternalLink className="size-3" aria-hidden />
              Ver no Instagram
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (publishStatus === "publishing") {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-600">
        <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
        Publicando no Instagram...
      </div>
    );
  }

  async function publishNow() {
    if (!connectionId) {
      toast.error("Escolha uma conta do Instagram.");
      return;
    }
    setBusy(true);
    try {
      const result = await publishContentNowAction(contentId, connectionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Publicado no Instagram.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitSchedule() {
    if (!connectionId) {
      toast.error("Escolha uma conta do Instagram.");
      return;
    }
    if (!scheduleDate) {
      toast.error("Escolha uma data.");
      return;
    }
    setBusy(true);
    try {
      const result = await scheduleContentPublishAction({ contentId, connectionId, scheduledDate: scheduleDate });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Publicacao agendada.");
      setScheduling(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancelSchedule() {
    setCancelBusy(true);
    try {
      const result = await cancelScheduledPublishAction(contentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Agendamento cancelado.");
      router.refresh();
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!isApproved ? (
        <p className="text-xs text-ink-500">So e possivel publicar direto um conteudo aprovado.</p>
      ) : null}

      {publishStatus === "failed" && publishError ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {publishError}
        </div>
      ) : null}

      {publishStatus === "scheduled" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-50 p-2.5 text-sm">
          <span className="text-ink-700">Agendado para {formatDate(scheduledDate)}</span>
          <Button size="sm" variant="ghost" loading={cancelBusy} onClick={() => void cancelSchedule()}>
            <X className="size-4" aria-hidden />
            Cancelar
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {connections.length > 1 ? (
              <div>
                <label className="field-label" htmlFor={`instagram-publish-connection-${contentId}`}>
                  Conta
                </label>
                <Select
                  id={`instagram-publish-connection-${contentId}`}
                  value={connectionId}
                  onChange={(event) => setConnectionId(event.target.value)}
                  disabled={busy || !isApproved}
                  className="max-w-[220px]"
                >
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.instagramUsername ? `@${connection.instagramUsername}` : (connection.label ?? "Conta conectada")}
                      {connection.isPrincipal ? " (principal)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <Button size="sm" loading={busy} disabled={!isApproved || !selectedConnection?.publishScopeGranted} onClick={() => void publishNow()}>
              <Send className="size-4" aria-hidden />
              Publicar agora
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !isApproved || !selectedConnection?.publishScopeGranted}
              onClick={() => setScheduling((value) => !value)}
            >
              <CalendarPlus className="size-4" aria-hidden />
              Agendar
            </Button>
          </div>

          {selectedConnection && !selectedConnection.publishScopeGranted ? (
            <p className="text-xs text-amber-700">
              Esta conta precisa ser reconectada (na tela de Relatorios) para habilitar a publicacao direta.
            </p>
          ) : null}

          {scheduling ? (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-ink-50 p-3">
              <div>
                <label className="field-label" htmlFor={`instagram-publish-date-${contentId}`}>
                  Data da publicacao
                </label>
                <Input
                  id={`instagram-publish-date-${contentId}`}
                  type="date"
                  min={todayIso()}
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  disabled={busy}
                  className="max-w-[180px]"
                />
              </div>
              <Button size="sm" loading={busy} onClick={() => void submitSchedule()}>
                Confirmar agendamento
              </Button>
              <p className="w-full text-xs text-ink-500">
                So a data e garantida -- a publicacao roda no proximo cron diario a partir dessa data, sem hora
                exata.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
