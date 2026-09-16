"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCheck, CheckCircle2, Eye, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, LinkButton } from "@/components/ui/button";
import { DownloadContentButton } from "@/components/content/download-content-button";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  approveContentAsStaffAction,
  deleteContentAction,
  setContentPublishedAction,
  submitContentAction,
} from "@/server/actions/contents";
import type { ContentStatus } from "@/types/database";

/** Status em que o conteudo ainda nao tem uma decisao do cliente registrada. */
const PENDING_DECISION_STATUSES: ContentStatus[] = [
  "submitted",
  "awaiting_approval",
  "revision_requested",
  "rejected",
];

export function StaffContentActions({
  contentId,
  status,
  basePath,
  onDeletedHref,
  downloadUrls,
}: {
  contentId: string;
  status: ContentStatus;
  basePath: string;
  onDeletedHref?: string;
  /** URLs de download forcado dos arquivos do post -- baixa tudo pra publicar manualmente. */
  downloadUrls?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState("");

  const canSubmit = status !== "awaiting_approval" && status !== "published";
  const canPublish = status === "approved";
  const canApproveAsStaff = PENDING_DECISION_STATUSES.includes(status);

  function run(operation: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        toast.error(result.error ?? "Nao foi possivel concluir a operacao.");
        return;
      }
      toast.success(message);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <LinkButton href={`${basePath}/content/${contentId}`} variant="outline" size="sm" className="gap-2">
          <Eye className="size-4" aria-hidden />
          Visualizar
        </LinkButton>

        <LinkButton
          href={`${basePath}/content/${contentId}/edit`}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Pencil className="size-4" aria-hidden />
          Editar
        </LinkButton>

        {canSubmit ? (
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              run(
                () => submitContentAction(contentId),
                status === "draft"
                  ? "Conteudo enviado para aprovacao."
                  : "Conteudo reenviado ao cliente.",
              )
            }
          >
            <Send className="size-4" aria-hidden />
            {status === "draft" ? "Enviar ao cliente" : "Reenviar"}
          </Button>
        ) : null}

        {canPublish ? (
          <Button
            size="sm"
            variant="success"
            loading={pending}
            onClick={() =>
              run(() => setContentPublishedAction(contentId), "Conteudo marcado como publicado.")
            }
          >
            <CheckCheck className="size-4" aria-hidden />
            Marcar como publicado
          </Button>
        ) : null}

        {canApproveAsStaff ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-emerald-700 hover:bg-emerald-50"
            disabled={pending}
            onClick={() => setApproveOpen(true)}
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Aprovar em nome do cliente
          </Button>
        ) : null}

        {downloadUrls ? <DownloadContentButton urls={downloadUrls} /> : null}

        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          Excluir
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Excluir conteudo"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteContentAction(contentId);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Conteudo excluido.");
                  setConfirmOpen(false);
                  if (onDeletedHref) router.push(onDeletedHref);
                  router.refresh();
                })
              }
            >
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Os arquivos, o historico e a posicao no feed serao removidos. Esta acao nao pode ser
          desfeita.
        </p>
      </Modal>

      <Modal
        open={approveOpen}
        onClose={() => {
          if (!pending) {
            setApproveOpen(false);
            setApproveNote("");
          }
        }}
        title="Aprovar em nome do cliente"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="success"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await approveContentAsStaffAction(contentId, approveNote);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Conteudo aprovado em nome do cliente.");
                  setApproveOpen(false);
                  setApproveNote("");
                  router.refresh();
                })
              }
            >
              Confirmar aprovacao
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-600">
          Use quando o cliente confirmou por fora do app (WhatsApp, telefone etc.) em vez de aprovar
          direto no portal. Fica registrado no historico que foi a equipe quem confirmou, nao o
          cliente.
        </p>
        <Field label="Observacao (opcional)" htmlFor="approve-note">
          <Textarea
            id="approve-note"
            rows={3}
            value={approveNote}
            onChange={(event) => setApproveNote(event.target.value)}
            placeholder="Ex.: cliente aprovou via WhatsApp em 16/09"
            disabled={pending}
          />
        </Field>
      </Modal>
    </>
  );
}
