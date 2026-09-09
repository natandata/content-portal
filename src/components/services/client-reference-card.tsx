"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Card, CardHeader } from "@/components/ui/layout";
import { Modal } from "@/components/ui/modal";
import { linkProviderLabel } from "@/lib/domain";
import {
  createClientReferenceAction,
  deleteClientReferenceAction,
  updateClientReferenceAction,
} from "@/server/actions/client-references";
import type { ClientReferenceRow } from "@/types/database";

/**
 * Banco de Referencias: links de conteudo que o profissional cadastra pra o
 * cliente gravar. O cliente ve a mesma lista no proprio dashboard (widget
 * "ReferenceBankWidget") e clica pra abrir em nova aba.
 */
export function ClientReferenceCard({
  clientId,
  references,
}: {
  clientId: string;
  references: ClientReferenceRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Nulo = modal em modo "adicionar"; preenchido = editando essa referencia.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setUrl("");
    setError(null);
    setEditingId(null);
  }

  function openToAdd() {
    reset();
    setOpen(true);
  }

  function openToEdit(reference: ClientReferenceRow) {
    setError(null);
    setEditingId(reference.id);
    setTitle(reference.title);
    setUrl(reference.url);
    setOpen(true);
  }

  function submit() {
    setError(null);
    if (title.trim().length < 2) {
      setError("Informe o titulo da referencia.");
      return;
    }
    if (!url.trim()) {
      setError("Informe o link da referencia.");
      return;
    }
    startTransition(async () => {
      const result = editingId
        ? await updateClientReferenceAction(editingId, { title, url })
        : await createClientReferenceAction({ clientId, title, url });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(editingId ? "Referencia atualizada." : "Referencia adicionada.");
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Banco de Referencias"
        actions={
          <IconButton label="Adicionar referencia" onClick={openToAdd}>
            <Plus className="size-4" />
          </IconButton>
        }
      />

      {references.length === 0 ? (
        <p className="text-sm text-ink-500">Nenhuma referencia cadastrada ainda.</p>
      ) : (
        <ul className="space-y-2.5">
          {references.map((reference) => (
            <li key={reference.id} className="flex items-center justify-between gap-2">
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex min-w-0 items-center gap-2 text-sm text-ink-800 hover:text-accent"
              >
                <Link2 className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{reference.title}</span>
                  <span className="block truncate text-xs text-ink-400">
                    {linkProviderLabel(reference.url)}
                  </span>
                </span>
                <ExternalLink className="size-3 shrink-0 text-ink-300" aria-hidden />
              </a>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton
                  label="Editar referencia"
                  className="size-7 text-ink-400 hover:text-ink-700"
                  disabled={pending}
                  onClick={() => openToEdit(reference)}
                >
                  <Pencil className="size-3.5" />
                </IconButton>
                <IconButton
                  label="Remover referencia"
                  className="size-7 text-ink-400 hover:text-red-600"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteClientReferenceAction(reference.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={editingId ? "Editar referencia" : "Adicionar referencia"}
        description='Ex.: "Reels de inspiracao" · link do YouTube/Instagram'
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={submit}>
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Titulo" htmlFor="reference-title" required>
            <Input
              id="reference-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={pending}
            />
          </Field>

          <Field label="Link" htmlFor="reference-url" required>
            <Input
              id="reference-url"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={pending}
            />
          </Field>

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </Card>
  );
}
