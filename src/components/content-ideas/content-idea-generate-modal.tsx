"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { BUCKETS, contentIdeaReportPath } from "@/lib/paths";
import { uploadToBucket, validateFile } from "@/lib/upload";
import { formatBytes } from "@/lib/utils";
import { attachContentIdeaReportAction, startContentIdeaGenerationAction } from "@/server/actions/content-ideas";

const MAX_REFERENCES = 5;

export function ContentIdeaGenerateModal({
  clientId,
  defaultClientUsername,
}: {
  clientId: string;
  defaultClientUsername?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [clientUsername, setClientUsername] = useState(defaultClientUsername ?? "");
  const [references, setReferences] = useState<string[]>([""]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateReference(index: number, value: string) {
    setReferences((current) => current.map((item, i) => (i === index ? value : item)));
  }

  function removeReference(index: number) {
    setReferences((current) => current.filter((_, i) => i !== index));
  }

  function reset() {
    setClientUsername(defaultClientUsername ?? "");
    setReferences([""]);
    setFile(null);
    setError(null);
  }

  async function submit() {
    setError(null);

    if (!clientUsername.trim()) {
      setError("Informe o perfil do cliente.");
      return;
    }
    const referenceUsernames = references.map((r) => r.trim()).filter(Boolean);
    if (referenceUsernames.length === 0) {
      setError("Informe pelo menos 1 perfil de referencia.");
      return;
    }
    setBusy(true);

    try {
      const started = await startContentIdeaGenerationAction({
        clientId,
        clientUsername,
        referenceUsernames,
      });
      if (!started.ok) {
        setError(started.error);
        return;
      }

      let path: string | null = null;
      if (file) {
        path = contentIdeaReportPath(clientId, started.data.id, file.name);
        const upload = await uploadToBucket(BUCKETS.contentIdeaReports, path, file, file.type);
        if (upload.error) {
          setError(`Nao foi possivel enviar o relatorio: ${upload.error}`);
          return;
        }
      }

      const attached = await attachContentIdeaReportAction(started.data.id, path);
      if (!attached.ok) {
        setError(attached.error);
        return;
      }

      toast.success("Geracao iniciada -- os 20 rascunhos aparecem aqui quando terminar.");
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Sparkles className="size-4" aria-hidden />
        Nova geracao
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Gerar ideias de conteudo por IA"
        description="A IA analisa perfis de referencia, o relatorio de metricas e o Banco de Referencias pra sugerir 20 posts adaptados ao cliente."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Gerar ideias
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Perfil do cliente" htmlFor="client-username" required hint="Instagram do proprio cliente, com ou sem @.">
            <Input
              id="client-username"
              value={clientUsername}
              onChange={(event) => setClientUsername(event.target.value)}
              placeholder="@perfildocliente"
              disabled={busy}
            />
          </Field>

          <Field label="Perfis de referencia" required hint="1 a 5 contas do Instagram que inspiram o conteudo.">
            <div className="space-y-2">
              {references.map((reference, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={reference}
                    onChange={(event) => updateReference(index, event.target.value)}
                    placeholder="@perfilreferencia"
                    disabled={busy}
                  />
                  {references.length > 1 ? (
                    <IconButton label="Remover perfil" onClick={() => removeReference(index)} disabled={busy}>
                      <X className="size-4" aria-hidden />
                    </IconButton>
                  ) : null}
                </div>
              ))}
            </div>
            {references.length < MAX_REFERENCES ? (
              <button
                type="button"
                onClick={() => setReferences((current) => [...current, ""])}
                disabled={busy}
                className="focus-ring mt-2 flex items-center gap-1.5 text-sm font-medium text-accent"
              >
                <Plus className="size-4" aria-hidden />
                Adicionar perfil
              </button>
            ) : null}
          </Field>

          <Field
            label="Relatorio de metricas (ultimos 3 meses)"
            hint="Opcional -- PDF exportado do Meta Business Suite, ou um screenshot."
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                event.target.value = "";
                if (!selected) return;

                const kind = selected.type === "application/pdf" ? "pdf" : "image";
                const message = validateFile(selected, kind);
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
                  {file ? file.name : "Selecionar PDF ou imagem"}
                </span>
                <span className="block text-xs text-ink-500">
                  {file ? formatBytes(file.size) : "PDF, JPG, PNG ou WEBP"}
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
