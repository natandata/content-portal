"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCheck, Eye, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, LinkButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  deleteContentAction,
  setContentPublishedAction,
  submitContentAction,
} from "@/server/actions/contents";
import type { ContentStatus } from "@/types/database";

export function StaffContentActions({
  contentId,
  status,
  basePath,
  onDeletedHref,
}: {
  contentId: string;
  status: ContentStatus;
  basePath: string;
  onDeletedHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canSubmit = status !== "awaiting_approval" && status !== "published";
  const canPublish = status === "approved";

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
    </>
  );
}
