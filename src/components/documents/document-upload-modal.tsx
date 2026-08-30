"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ExternalLink, FileUp, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_DEFAULT_TITLE,
  DOCUMENT_KIND_LABEL,
  defaultRequiresSignature,
} from "@/lib/domain";
import { BUCKETS, contractPath } from "@/lib/paths";
import { uploadToBucket, validateFile } from "@/lib/upload";
import { cn, formatBytes } from "@/lib/utils";
import type { DocumentKind } from "@/types/database";
import { attachDocumentFileAction, createDocumentAction } from "@/server/actions/documents";

export interface ClientOption {
  id: string;
  companyName: string;
}

export function DocumentUploadModal({
  clients,
  defaultClientId,
  label = "Novo documento",
}: {
  clients: ClientOption[];
  defaultClientId?: string;
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [kind, setKind] = useState<DocumentKind>("contract");
  const [title, setTitle] = useState(DOCUMENT_KIND_DEFAULT_TITLE.contract);
  const [requiresSignature, setRequiresSignature] = useState(true);
  const [allowGovBrSignature, setAllowGovBrSignature] = useState(false);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);

    if (!clientId) {
      setError("Selecione o cliente.");
      return;
    }
    if (title.trim().length < 2) {
      setError("Informe o nome do documento.");
      return;
    }
    if (!file) {
      setError("Selecione o PDF do documento.");
      return;
    }

    setBusy(true);

    try {
      const created = await createDocumentAction({
        clientId,
        title,
        notes,
        kind,
        requiresSignature,
        allowGovBrSignature: requiresSignature && allowGovBrSignature,
      });
      if (!created.ok) {
        setError(created.error);
        return;
      }

      const contract = created.data;
      const path = contractPath(clientId, contract.id, file.name);
      const upload = await uploadToBucket(BUCKETS.contracts, path, file, "application/pdf");

      if (upload.error) {
        setError(`Nao foi possivel enviar o PDF: ${upload.error}`);
        return;
      }

      const attached = await attachDocumentFileAction(contract.id, path);
      if (!attached.ok) {
        setError(attached.error);
        return;
      }

      toast.success(`${DOCUMENT_KIND_LABEL[kind]} enviado ao cliente.`);
      setOpen(false);
      setFile(null);
      setNotes("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Enviar documento"
        description={
          requiresSignature
            ? "O cliente recebe o PDF para baixar, assinar e devolver assinado."
            : "O cliente recebe o PDF para ler e baixar. Nao pede devolucao."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Enviar documento
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Cliente" htmlFor="contract-client" required>
            <Select
              id="contract-client"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={busy || Boolean(defaultClientId)}
            >
              <option value="">Selecione...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipo" htmlFor="document-kind" required>
            <Select
              id="document-kind"
              value={kind}
              onChange={(event) => {
                const next = event.target.value as DocumentKind;
                const suggestion = DOCUMENT_KIND_DEFAULT_TITLE[next];

                // So sobrescreve o titulo se ele ainda for a sugestao anterior:
                // texto digitado a mao nao pode sumir na troca de tipo.
                setTitle((current) =>
                  Object.values(DOCUMENT_KIND_DEFAULT_TITLE).includes(current)
                    ? suggestion
                    : current,
                );
                const nextRequires = defaultRequiresSignature(next);
                setRequiresSignature(nextRequires);
                if (!nextRequires) setAllowGovBrSignature(false);
                setKind(next);
              }}
              disabled={busy}
            >
              {DOCUMENT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {DOCUMENT_KIND_LABEL[option]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Nome do documento" htmlFor="contract-title" required>
            <Input
              id="contract-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
            />
          </Field>

          <label className="flex items-start gap-2.5 rounded-xl border border-line bg-ink-50/60 px-3 py-2.5">
            <input
              type="checkbox"
              checked={requiresSignature}
              onChange={(event) => {
                const checked = event.target.checked;
                setRequiresSignature(checked);
                if (!checked) setAllowGovBrSignature(false);
              }}
              disabled={busy}
              className="mt-0.5 size-4 accent-ink-900"
            />
            <span>
              <span className="block text-sm font-medium text-ink-900">
                Pedir devolucao assinada
              </span>
              <span className="block text-xs text-ink-500">
                Marcado, o cliente ve o botao para enviar o arquivo assinado de volta.
              </span>
            </span>
          </label>

          <label
            className={cn(
              "flex items-start gap-2.5 rounded-xl border border-line px-3 py-2.5 transition",
              requiresSignature ? "bg-ink-50/60" : "cursor-not-allowed bg-ink-50/30 opacity-60",
            )}
          >
            <input
              type="checkbox"
              checked={allowGovBrSignature}
              onChange={(event) => setAllowGovBrSignature(event.target.checked)}
              disabled={busy || !requiresSignature}
              className="mt-0.5 size-4 accent-ink-900"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                Habilitar assinatura
                <ExternalLink className="size-3.5 text-ink-400" aria-hidden />
              </span>
              <span className="block text-xs text-ink-500">
                Mostra ao cliente o botao &ldquo;Assinar com Gov.br&rdquo;, que abre o
                assinador oficial do governo em outra aba. E um atalho — o cliente ainda
                baixa o PDF aqui e devolve o assinado por este mesmo formulario.
              </span>
            </span>
          </label>

          <Field label="Observacao" htmlFor="contract-notes" hint="Opcional.">
            <Textarea
              id="contract-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
            />
          </Field>

          <Field label="Arquivo PDF" required>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                event.target.value = "";
                if (!selected) return;

                const message = validateFile(selected, "pdf");
                if (message) {
                  setError(message);
                  return;
                }
                setError(null);
                setFile(selected);
              }}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="focus-ring flex w-full items-center gap-3 rounded-xl border border-dashed border-line bg-ink-50/60 px-4 py-4 text-left transition hover:bg-ink-100"
            >
              <FileUp className="size-5 shrink-0 text-ink-400" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-800">
                  {file ? file.name : "Selecionar PDF"}
                </span>
                <span className="block text-xs text-ink-500">
                  {file ? formatBytes(file.size) : "Apenas PDF, ate 25 MB"}
                </span>
              </span>
            </button>
          </Field>

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
