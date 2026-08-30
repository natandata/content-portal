"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { createBulletinPostAction, updateBulletinPostAction } from "@/server/actions/bulletin";

/** Criar/editar uma novidade do mural. So admin abre isto. */
export function BulletinPostForm({
  open,
  onClose,
  post,
  locale = DEFAULT_LOCALE,
}: {
  open: boolean;
  onClose: () => void;
  post?: BulletinFormPost;
  locale?: Locale;
}) {
  const dict = getDictionary(locale).bulletin;
  const router = useRouter();
  const isEdit = Boolean(post);

  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [published, setPublished] = useState(post?.published ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);

    try {
      const result = isEdit
        ? await updateBulletinPostAction(post!.id, { title, body, published })
        : await createBulletinPostAction({ title, body, published });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(isEdit ? dict.updatedToast : dict.createdToast);
      onClose();
      if (!isEdit) {
        setTitle("");
        setBody("");
        setPublished(true);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={isEdit ? dict.editPost : dict.newPost}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {dict.cancel}
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            {dict.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={dict.postTitle} htmlFor="bulletin-title" required>
          <Input
            id="bulletin-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            disabled={busy}
          />
        </Field>

        <Field label={dict.postBody} htmlFor="bulletin-body" required>
          <Textarea
            id="bulletin-body"
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            disabled={busy}
          />
        </Field>

        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-ink-50/60 px-3 py-2.5">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
            disabled={busy}
            className="size-4 accent-ink-900"
          />
          <span className="text-sm font-medium text-ink-900">{dict.publish}</span>
        </label>

        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}

export interface BulletinFormPost {
  id: string;
  title: string;
  body: string;
  published: boolean;
}
