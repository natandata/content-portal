"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Eye, MessageSquareWarning, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button, LinkButton } from "@/components/ui/button";
import { Field, FormError, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { submitApprovalAction } from "@/server/actions/approvals";
import type { ContentStatus } from "@/types/database";

type Intent = "rejected" | "revision_requested";

function intentCopy(dict: Dictionary): Record<Intent, { title: string; question: string; cta: string }> {
  return {
    rejected: {
      title: dict.approval.modalRejectTitle,
      question: dict.approval.modalRejectField,
      cta: dict.approval.confirmReject,
    },
    revision_requested: {
      title: dict.approval.modalRequestTitle,
      question: dict.approval.modalRequestField,
      cta: dict.approval.sendRequest,
    },
  };
}

/** Barra de acoes do cliente: sempre visivel na base do conteudo. */
export function ApprovalActions({
  contentId,
  status,
  viewHref,
  locale = DEFAULT_LOCALE,
}: {
  contentId: string;
  status: ContentStatus;
  viewHref?: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale);
  const INTENT_COPY = intentCopy(t);
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
    return <p className="text-sm text-ink-500">{t.content.draftNotice}</p>;
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
            {t.content.view}
          </LinkButton>
        ) : null}

        <Button
          size="sm"
          variant="success"
          loading={pending}
          disabled={decided}
          onClick={() => run({ status: "approved" }, t.approval.approvedToast)}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          {t.content.approve}
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={pending || decided}
          onClick={() => setIntent("rejected")}
        >
          <XCircle className="size-4" aria-hidden />
          {t.content.reject}
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={pending || decided}
          className="col-span-2 sm:col-span-1"
          onClick={() => setIntent("revision_requested")}
        >
          <MessageSquareWarning className="size-4" aria-hidden />
          {t.content.requestChange}
        </Button>
      </div>

      {decided ? <p className="mt-2.5 text-xs text-ink-500">{t.content.decidedNotice}</p> : null}

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
              {t.approval.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                if (!intent) return;
                if (comment.trim().length < 3) {
                  setError(t.approval.commentRequired);
                  return;
                }
                run(
                  { status: intent, comment: comment.trim() },
                  intent === "rejected" ? t.approval.rejectedToast : t.approval.revisionToast,
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
            placeholder={
              intent === "rejected"
                ? t.approval.modalRejectPlaceholder
                : t.approval.modalRequestPlaceholder
            }
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
