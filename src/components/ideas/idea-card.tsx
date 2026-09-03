"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { IdeaFormModal, type IdeaClientOption } from "@/components/ideas/idea-form-modal";
import { deleteIdeaAction } from "@/server/actions/ideas";
import { initials } from "@/lib/utils";
import type { IdeaImageRow, IdeaRow } from "@/types/database";

export function IdeaCard({
  idea,
  images,
  imageUrls,
  professionalId,
  clients,
  clientName,
}: {
  idea: IdeaRow;
  images: IdeaImageRow[];
  imageUrls: Map<string, string>;
  professionalId: string;
  clients: IdeaClientOption[];
  clientName?: string;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      const result = await deleteIdeaAction(idea.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Ideia excluida.");
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  const cover = images[0] ? imageUrls.get(images[0].file_path) : null;

  return (
    <div className="card flex flex-col gap-3 p-4">
      {cover ? (
        <div className="grid grid-cols-3 gap-1.5">
          {images.slice(0, 3).map((image) => {
            const url = imageUrls.get(image.file_path);
            return url ? (
              <div key={image.id} className="aspect-square overflow-hidden rounded-lg bg-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" />
              </div>
            ) : null;
          })}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        {clientName ? (
          <span className="mb-1.5 flex w-fit items-center gap-1.5 rounded-full bg-ink-100 py-0.5 pr-2.5 pl-0.5 text-[11px] font-medium text-ink-600">
            <span className="flex size-4 items-center justify-center rounded-full bg-ink-900 text-[8px] font-semibold text-on-ink">
              {initials(clientName)}
            </span>
            {clientName}
          </span>
        ) : null}
        <h3 className="truncate text-sm font-semibold text-ink-900">{idea.title}</h3>
        {idea.notes ? <p className="mt-1 line-clamp-3 text-sm text-ink-500">{idea.notes}</p> : null}
      </div>

      {idea.links.length > 0 ? (
        <div className="flex flex-col gap-1">
          {idea.links.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 truncate text-xs font-medium text-accent hover:underline"
            >
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              {link.label}
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-end gap-1.5 border-t border-line pt-3">
        <IdeaFormModal
          idea={idea}
          images={images}
          imageUrls={imageUrls}
          professionalId={professionalId}
          clients={clients}
          trigger={(openModal) => (
            <IconButton label="Editar ideia" onClick={openModal}>
              <Pencil className="size-4" />
            </IconButton>
          )}
        />
        <IconButton label="Excluir ideia" onClick={() => setDeleteOpen(true)} className="text-destructive">
          <Trash2 className="size-4" />
        </IconButton>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => !deleteBusy && setDeleteOpen(false)}
        title="Excluir ideia"
        description={`Tem certeza que deseja excluir "${idea.title}"? Esta acao nao pode ser desfeita.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleteBusy} onClick={() => void handleDelete()}>
              Excluir
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  );
}
