"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ideaImagePath, BUCKETS } from "@/lib/paths";
import { uploadToBucket, validateFile } from "@/lib/upload";
import {
  addIdeaImageAction,
  createIdeaAction,
  deleteIdeaImageAction,
  updateIdeaAction,
} from "@/server/actions/ideas";
import type { IdeaImageRow, IdeaLink, IdeaRow } from "@/types/database";

export function IdeaFormModal({
  idea,
  images,
  imageUrls,
  professionalId,
  trigger,
}: {
  idea?: IdeaRow;
  images?: IdeaImageRow[];
  imageUrls?: Map<string, string>;
  professionalId: string;
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const isEditing = Boolean(idea);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [ideaId, setIdeaId] = useState(idea?.id);
  const [title, setTitle] = useState(idea?.title ?? "");
  const [notes, setNotes] = useState(idea?.notes ?? "");
  const [links, setLinks] = useState<IdeaLink[]>(idea?.links ?? []);
  const [currentImages, setCurrentImages] = useState(images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  function reset() {
    if (isEditing) return;
    setTitle("");
    setNotes("");
    setLinks([]);
    setIdeaId(undefined);
    setCurrentImages([]);
  }

  function addLink() {
    setLinks((prev) => [...prev, { label: "", url: "" }]);
  }

  function updateLink(index: number, field: keyof IdeaLink, value: string) {
    setLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    setError(null);

    if (title.trim().length < 2) {
      setError("Informe o titulo da ideia.");
      return;
    }
    const cleanedLinks = links.filter((link) => link.label.trim() || link.url.trim());
    for (const link of cleanedLinks) {
      if (!link.label.trim() || !link.url.trim()) {
        setError("Preencha titulo e link em cada referencia adicionada.");
        return;
      }
    }

    setBusy(true);
    try {
      const payload = { title, notes, links: cleanedLinks };
      const result = idea
        ? await updateIdeaAction(idea.id, payload)
        : await createIdeaAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Ainda criando (sem imagens pendentes): fecha e recarrega normal.
      if (!isEditing && currentImages.length === 0) {
        setIdeaId(result.data.id);
        toast.success("Ideia criada.");
        setOpen(false);
        reset();
        router.refresh();
        return;
      }

      toast.success(isEditing ? "Ideia atualizada." : "Ideia criada.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** Em criacao, a ideia so ganha ID depois de salva uma vez — o usuario
   * precisa clicar em "Criar" antes de conseguir anexar imagens. */
  async function ensureIdeaId(): Promise<string | null> {
    if (ideaId) return ideaId;

    if (title.trim().length < 2) {
      setError("Informe o titulo antes de anexar imagens.");
      return null;
    }

    const result = await createIdeaAction({ title, notes, links: links.filter((l) => l.label && l.url) });
    if (!result.ok) {
      setError(result.error);
      return null;
    }

    setIdeaId(result.data.id);
    return result.data.id;
  }

  async function handleImageUpload(file: File) {
    setError(null);
    const message = validateFile(file, "image");
    if (message) {
      setError(message);
      return;
    }

    setUploadingImage(true);
    try {
      const id = await ensureIdeaId();
      if (!id) return;

      const path = ideaImagePath(professionalId, id, file.name);
      const upload = await uploadToBucket(BUCKETS.ideas, path, file);
      if (upload.error) {
        setError(`Falha ao enviar imagem: ${upload.error}`);
        return;
      }

      const saved = await addIdeaImageAction(id, path);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      setCurrentImages((prev) => [...prev, saved.data]);
      router.refresh();
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleImageDelete(imageId: string) {
    const result = await deleteIdeaImageAction(imageId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCurrentImages((prev) => prev.filter((img) => img.id !== imageId));
    router.refresh();
  }

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nova ideia
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={isEditing ? "Editar ideia" : "Nova ideia"}
        description="Anote referencias, links de conteudo e imagens de inspiracao."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Fechar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              {isEditing ? "Salvar alteracoes" : "Criar ideia"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Titulo" htmlFor="idea-title" required>
            <Input
              id="idea-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              autoFocus
            />
          </Field>

          <Field label="Anotacoes" htmlFor="idea-notes">
            <Textarea
              id="idea-notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
              placeholder="Descreva a ideia, formato, referencias..."
            />
          </Field>

          <Field label="Links de referencia">
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Link2 className="size-4 shrink-0 text-ink-400" aria-hidden />
                  <Input
                    value={link.label}
                    onChange={(event) => updateLink(index, "label", event.target.value)}
                    placeholder="Titulo (ex.: Reels concorrente)"
                    disabled={busy}
                    className="flex-1"
                  />
                  <Input
                    value={link.url}
                    onChange={(event) => updateLink(index, "url", event.target.value)}
                    placeholder="https://..."
                    disabled={busy}
                    className="flex-1"
                  />
                  <IconButton label="Remover link" onClick={() => removeLink(index)} disabled={busy}>
                    <X className="size-4" />
                  </IconButton>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addLink} disabled={busy} type="button">
                <Plus className="size-3.5" aria-hidden />
                Adicionar link
              </Button>
            </div>
          </Field>

          <Field label="Imagens">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleImageUpload(file);
              }}
            />

            <div className="flex flex-wrap gap-3">
              {currentImages.map((image) => (
                <div key={image.id} className="group relative size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-100">
                  {imageUrls?.get(image.file_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrls.get(image.file_path)}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleImageDelete(image.id)}
                    className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-ink-900/70 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label="Remover imagem"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploadingImage || busy}
                className="focus-ring flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-400 transition hover:bg-ink-50"
              >
                {uploadingImage ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <ImagePlus className="size-5" aria-hidden />
                    <span className="text-[10px]">Adicionar</span>
                  </>
                )}
              </button>
            </div>
          </Field>

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
