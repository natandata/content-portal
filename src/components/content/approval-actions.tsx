"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Eye, MessageSquareWarning, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button, LinkButton } from "@/components/ui/button";
import { Field, FormError, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { submitApprovalAction } from "@/server/actions/approvals";
import type { ContentStatus } from "@/types/database";

type Intent = "rejected" | "revision_requested";

const INTENT_COPY: Record<Intent, { title: string; question: string; cta: string }> = {
  rejected: {
    title: "Reprovar conteudo",
    question: "Por que este conteudo precisa ser refeito?",
    cta: "Enviar reprovacao",
  },
  revision_requested: {
    title: "Solicitar alteracao",
    question: "O que precisa ser alterado?",
    cta: "Enviar solicitacao",
  },
};

/** Barra de acoes do cliente: sempre visivel na base do conteudo. */
export function ApprovalActions({
  contentId,
  status,
  viewHref,
}: {
  contentId: string;
  status: ContentStatus;
  viewHref?: string;
}) {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decided = status === "approved" || status === "published";
  const isDraft = status === "draft";

  function run(
    payload: { status: "approved" | Intent; comment?: string },
    successMessage: string,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await submitApprovalAction({
        contentId,
        status: payload.status,
        comment: payload.comment,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(successMessage);
      setIntent(null);
      setComment("");
      router.refresh();
    });
  }

  if (isDraft) {
    return (
      <p className="text-sm text-ink-500">Este conteudo ainda esta em producao.</p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {viewHref ? (
          <LinkButton
            href={viewHref}
            variant="outline"
            size="sm"
            className="col-span-2 gap-2 sm:col-span-1"
          >
            <Eye className="size-4" aria-hidden />
            Visualizar
          </LinkButton>
        ) : null}

        <Button
          size="sm"
          variant="success"
          loading={pending}
          disabled={decided}
          onClick={() => run({ status: "approved" }, "Conteudo aprovado.")}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Aprovar
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={pending || decided}
          onClick={() => setIntent("rejected")}
        >
          <XCircle className="size-4" aria-hidden />
          Reprovar
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={pending || decided}
          className="col-span-2 sm:col-span-1"
          onClick={() => setIntent("revision_requested")}
        >
          <MessageSquareWarning className="size-4" aria-hidden />
          Solicitar alteracao
        </Button>
      </div>

      {decided ? (
        <p className="mt-2.5 text-xs text-ink-500">
          Este conteudo ja foi aprovado. Fale com seu gestor para reabrir a revisao.
        </p>
      ) : null}

      <Modal
        open={intent !== null}
        onClose={() => {
          if (!pending) {
            setIntent(null);
            setError(null);
          }
        }}
        title={intent ? INTENT_COPY[intent].title : ""}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIntent(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                if (!intent) return;
                if (comment.trim().length < 3) {
                  setError("Escreva ao menos algumas palavras para orientar o profissional.");
                  return;
                }
                run(
                  { status: intent, comment: comment.trim() },
                  intent === "rejected" ? "Reprovacao enviada." : "Solicitacao enviada.",
                );
              }}
            >
              {intent ? INTENT_COPY[intent].cta : ""}
            </Button>
          </>
        }
      >
        <Field label={intent ? INTENT_COPY[intent].question : ""} required>
          <Textarea
            autoFocus
            rows={5}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Ex.: trocar a foto do slide 2 e ajustar a legenda."
            disabled={pending}
          />
        </Field>
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
