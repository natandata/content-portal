"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { BUCKETS, contentFilePath, thumbnailPath } from "@/lib/paths";
import { createThumbnail, uploadToBucket, validateFile } from "@/lib/upload";
import { addFeedItemAction } from "@/server/actions/feed";
import { createContentDraftAction, replaceContentFilesAction } from "@/server/actions/contents";

/**
 * Sobe uma foto direto para a proxima posicao livre do feed, sem passar pela
 * tela de Conteudo. Por baixo dos panos cria o mesmo conteudo tipo "imagem"
 * que o fluxo normal criaria — so pula o formulario.
 */
export function QuickFeedUpload({
  clientId,
  open,
  onClose,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setError(null);
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  function pick(file: File) {
    const message = validateFile(file, "image");
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ file, url: URL.createObjectURL(file) });
  }

  async function submit() {
    if (!preview) return;
    setBusy(true);
    setError(null);

    try {
      const title = `Foto do feed — ${new Date().toLocaleDateString("pt-BR")}`;
      const created = await createContentDraftAction({ clientId, title, type: "image" });
      if (!created.ok) {
        setError(created.error);
        return;
      }

      const contentId = created.data.id;
      const path = contentFilePath(clientId, contentId, 1, preview.file.name);
      const uploadResult = await uploadToBucket(BUCKETS.content, path, preview.file);
      if (uploadResult.error) {
        setError(`Falha ao enviar a imagem: ${uploadResult.error}`);
        return;
      }

      let thumbPath: string | null = null;
      const thumbnail = await createThumbnail(preview.file);
      if (thumbnail) {
        const candidate = thumbnailPath(clientId, contentId, 1);
        const thumbResult = await uploadToBucket(BUCKETS.thumbnails, candidate, thumbnail, "image/jpeg");
        if (!thumbResult.error) thumbPath = candidate;
      }

      const filesResult = await replaceContentFilesAction(contentId, [
        { filePath: path, thumbnailPath: thumbPath, position: 1, fileType: preview.file.type },
      ]);
      if (!filesResult.ok) {
        setError(filesResult.error);
        return;
      }

      const feedResult = await addFeedItemAction(clientId, contentId);
      if (!feedResult.ok) {
        setError(feedResult.error);
        return;
      }

      toast.success("Foto adicionada ao feed.");
      reset();
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Adicionar foto ao feed"
      description="Sobe direto para a proxima posicao livre — nao precisa criar em Conteudo."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          <Button loading={busy} disabled={!preview} onClick={() => void submit()}>
            {busy ? "Enviando..." : "Adicionar ao feed"}
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) pick(file);
          event.target.value = "";
        }}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="Previa" className="aspect-square w-full object-cover" />
          <button
            type="button"
            aria-label="Trocar imagem"
            onClick={() => !busy && reset()}
            disabled={busy}
            className="focus-ring absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-ink-900/70 text-white transition hover:bg-ink-900/90 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="focus-ring flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-ink-400 transition hover:border-ink-300 hover:text-ink-600"
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-6" aria-hidden />
          )}
          <span className="text-sm font-medium">Escolher imagem</span>
          <span className="text-xs text-ink-400">JPG, PNG ou WEBP</span>
        </button>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </Modal>
  );
}
