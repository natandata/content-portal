"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BulletinPostForm } from "@/components/bulletin/bulletin-post-form";
import { VoteButtons } from "@/components/bulletin/vote-buttons";
import { IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/utils";
import { deleteBulletinPostAction } from "@/server/actions/bulletin";
import type { BulletinFeedRow } from "@/types/database";

export function BulletinCard({
  post,
  locale = DEFAULT_LOCALE,
  canManage = false,
  published = true,
}: {
  post: BulletinFeedRow;
  locale?: Locale;
  canManage?: boolean;
  /** So relevante quando `canManage`: pre-preenche o toggle "Publicada" na edicao. */
  published?: boolean;
}) {
  const dict = getDictionary(locale).bulletin;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const result = await deleteBulletinPostAction(post.id);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(dict.deletedToast);
    setConfirmingDelete(false);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-900">{post.title}</h3>
            {canManage && !published ? (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                {dict.draft}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-ink-400">
            {formatDate(post.created_at, intlLocale(locale))}
          </p>
        </div>

        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <IconButton label={dict.editPost} className="size-8" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
            </IconButton>
            <IconButton
              label={dict.delete}
              className="size-8 hover:text-red-600"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-sm whitespace-pre-wrap text-ink-700">{post.body}</p>

      <div className="mt-4">
        <VoteButtons
          postId={post.id}
          likes={post.likes}
          dislikes={post.dislikes}
          myVote={post.my_vote}
          locale={locale}
        />
      </div>

      {canManage ? (
        <BulletinPostForm
          open={editing}
          onClose={() => setEditing(false)}
          post={{ id: post.id, title: post.title, body: post.body, published }}
          locale={locale}
        />
      ) : null}

      <Modal
        open={confirmingDelete}
        onClose={() => !busy && setConfirmingDelete(false)}
        title={dict.delete}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              {dict.cancel}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>
              {dict.delete}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{dict.confirmDelete}</p>
      </Modal>
    </div>
  );
}
