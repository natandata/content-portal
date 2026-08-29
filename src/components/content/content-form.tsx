"use client";

import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";
import { toast } from "sonner";

import { LinkPicker } from "@/components/content/link-picker";
import { MediaPicker, type PickedFile } from "@/components/content/media-picker";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/layout";
import { CONTENT_TYPE_LABEL, normalizeExternalUrl } from "@/lib/domain";
import { BUCKETS, contentFilePath, thumbnailPath } from "@/lib/paths";
import { createThumbnail, uploadToBucket } from "@/lib/upload";
import { cn } from "@/lib/utils";
import {
  createContentDraftAction,
  replaceContentFilesAction,
  submitContentAction,
  updateContentAction,
} from "@/server/actions/contents";
import type { ContentRow, ContentType } from "@/types/database";

export interface ClientOption {
  id: string;
  companyName: string;
}

interface Props {
  basePath: string;
  clients: ClientOption[];
  defaultClientId?: string;
  content?: ContentRow;
  /** Link ja cadastrado, quando o conteudo em edicao usa arquivo externo. */
  currentLink?: string | null;
}

interface UploadedFile {
  filePath: string;
  thumbnailPath: string | null;
  position: number;
  fileType: string;
}

/** Envia arquivos e miniaturas direto para o Storage, na ordem escolhida. */
async function uploadPickedFiles(
  clientId: string,
  contentId: string,
  files: PickedFile[],
  onProgress: (done: number, total: number) => void,
): Promise<{ uploaded: UploadedFile[]; error: string | null }> {
  const uploaded: UploadedFile[] = [];

  for (const [index, item] of files.entries()) {
    const position = index + 1;
    const path = contentFilePath(clientId, contentId, position, item.file.name);

    const result = await uploadToBucket(BUCKETS.content, path, item.file);
    if (result.error) {
      return { uploaded, error: `Falha ao enviar "${item.file.name}": ${result.error}` };
    }

    let thumbPath: string | null = null;
    const thumbnail = await createThumbnail(item.file);
    if (thumbnail) {
      const candidate = thumbnailPath(clientId, contentId, position);
      const thumbResult = await uploadToBucket(
        BUCKETS.thumbnails,
        candidate,
        thumbnail,
        "image/jpeg",
      );
      if (!thumbResult.error) thumbPath = candidate;
    }

    uploaded.push({
      filePath: path,
      thumbnailPath: thumbPath,
      position,
      fileType: item.file.type,
    });

    onProgress(position, files.length);
  }

  return { uploaded, error: null };
}

type Source = "upload" | "link";

export function ContentForm({
  basePath,
  clients,
  defaultClientId,
  content,
  currentLink,
}: Props) {
  const router = useRouter();
  const isEdit = Boolean(content);

  const [clientId, setClientId] = useState(content?.client_id ?? defaultClientId ?? "");
  const [title, setTitle] = useState(content?.title ?? "");
  const [type, setType] = useState<ContentType>(content?.type ?? "image");
  const [description, setDescription] = useState(content?.description ?? "");
  const [scheduledDate, setScheduledDate] = useState(content?.scheduled_date ?? "");
  const [caption, setCaption] = useState(content?.caption ?? "");
  const [internalNotes, setInternalNotes] = useState(content?.internal_notes ?? "");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [source, setSource] = useState<Source>(currentLink ? "link" : "upload");
  const [link, setLink] = useState(currentLink ?? "");

  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const metadata = {
    clientId,
    title,
    description,
    type,
    scheduledDate,
    caption,
    internalNotes,
  };

  async function persistFiles(targetClientId: string, contentId: string): Promise<string | null> {
    if (source === "link") {
      const normalized = normalizeExternalUrl(link);
      // Link vazio na edicao significa "mantem o que ja esta la".
      if (!normalized) return null;

      const result = await replaceContentFilesAction(contentId, [
        { externalUrl: normalized, position: 1 },
      ]);
      return result.ok ? null : result.error;
    }

    if (files.length === 0) return null;

    setProgress(`Enviando 0 de ${files.length} arquivo(s)...`);

    const { uploaded, error: uploadError } = await uploadPickedFiles(
      targetClientId,
      contentId,
      files,
      (done, total) => setProgress(`Enviando ${done} de ${total} arquivo(s)...`),
    );

    if (uploadError) return uploadError;

    const result = await replaceContentFilesAction(contentId, uploaded);
    return result.ok ? null : result.error;
  }

  async function handleSubmit(event: SyntheticEvent, submitToClient: boolean) {
    event.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Selecione o cliente.");
      return;
    }
    if (title.trim().length < 2) {
      setError("Informe o titulo do conteudo.");
      return;
    }
    if (source === "link") {
      const normalized = normalizeExternalUrl(link);
      if (!normalized && (!isEdit || link.trim().length > 0)) {
        setError("Informe um link valido, comecando com https://");
        return;
      }
    } else if (!isEdit && files.length === 0) {
      setError("Adicione ao menos um arquivo.");
      return;
    }

    setBusy(true);

    try {
      if (isEdit && content) {
        const updated = await updateContentAction(content.id, metadata);
        if (!updated.ok) {
          setError(updated.error);
          return;
        }

        const filesError = await persistFiles(content.client_id, content.id);
        if (filesError) {
          setError(filesError);
          return;
        }

        if (submitToClient) {
          const sent = await submitContentAction(content.id);
          if (!sent.ok) {
            setError(sent.error);
            return;
          }
        }

        toast.success(submitToClient ? "Conteudo reenviado ao cliente." : "Conteudo atualizado.");
        router.push(`${basePath}/content/${content.id}`);
        router.refresh();
        return;
      }

      const created = await createContentDraftAction(metadata);
      if (!created.ok) {
        setError(created.error);
        return;
      }

      const draft = created.data;
      const filesError = await persistFiles(draft.client_id, draft.id);
      if (filesError) {
        setError(
          `${filesError} O rascunho foi criado — abra o conteudo para tentar o envio novamente.`,
        );
        return;
      }

      if (submitToClient) {
        const sent = await submitContentAction(draft.id);
        if (!sent.ok) {
          setError(sent.error);
          return;
        }
      }

      toast.success(
        submitToClient ? "Conteudo enviado para aprovacao." : "Rascunho salvo com sucesso.",
      );
      router.push(`${basePath}/content/${draft.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha inesperada no envio.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void handleSubmit(event, false)}>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente" htmlFor="clientId" required>
            <Select
              id="clientId"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={busy || isEdit}
              required
            >
              <option value="">Selecione...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipo" htmlFor="type" required>
            <Select
              id="type"
              value={type}
              onChange={(event) => {
                const next = event.target.value as ContentType;
                setType(next);
                setFiles([]);
              }}
              disabled={busy || isEdit}
            >
              {(Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map((option) => (
                <option key={option} value={option}>
                  {CONTENT_TYPE_LABEL[option]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Titulo" htmlFor="title" required className="sm:col-span-2">
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Post 04 — lancamento"
              disabled={busy}
              required
            />
          </Field>

          <Field label="Data prevista" htmlFor="scheduledDate">
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
              disabled={busy}
            />
          </Field>

          <Field label="Descricao" htmlFor="description">
            <Input
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Resumo interno rapido"
              disabled={busy}
            />
          </Field>

          <Field label="Legenda" htmlFor="caption" className="sm:col-span-2">
            <Textarea
              id="caption"
              rows={4}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Legenda que sera publicada junto do conteudo"
              disabled={busy}
            />
          </Field>

          <Field
            label="Observacao interna"
            htmlFor="internalNotes"
            hint="Visivel apenas para a equipe."
            className="sm:col-span-2"
          >
            <Textarea
              id="internalNotes"
              rows={3}
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              disabled={busy}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-ink-900">
          {isEdit ? "Substituir arquivos" : "Arquivos"}
        </h2>
        <p className="mb-4 text-sm text-ink-500">
          {source === "link"
            ? isEdit
              ? "Cole um novo link apenas se quiser substituir o atual."
              : "O arquivo fica hospedado fora do portal e o cliente abre pelo link."
            : isEdit
              ? "Selecione novos arquivos apenas se quiser substituir os atuais."
              : type === "carousel"
                ? "Ate 10 slides. A ordem escolhida aqui e a ordem publicada."
                : "Um arquivo por conteudo."}
        </p>

        {/* Video grande nao precisa passar pelo Storage: link resolve. */}
        <div className="mb-4 grid max-w-sm grid-cols-2 gap-1.5 rounded-xl bg-ink-50 p-1.5">
          {(
            [
              ["upload", "Enviar arquivo"],
              ["link", "Usar link"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => {
                setSource(value);
                setError(null);
              }}
              className={cn(
                "focus-ring rounded-lg py-2 text-sm font-medium transition",
                source === value
                  ? "bg-surface text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {source === "link" ? (
          <LinkPicker value={link} onChange={setLink} disabled={busy} />
        ) : (
          <MediaPicker type={type} items={files} onChange={setFiles} disabled={busy} />
        )}
      </Card>

      <FormError>{error}</FormError>

      {progress ? (
        <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink-600">
          {progress}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="outline" loading={busy}>
          {isEdit ? "Salvar alteracoes" : "Salvar rascunho"}
        </Button>
        <Button
          type="button"
          loading={busy}
          onClick={(event) => void handleSubmit(event, true)}
        >
          {isEdit ? "Salvar e reenviar" : "Salvar e enviar ao cliente"}
        </Button>
      </div>
    </form>
  );
}
