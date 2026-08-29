"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { BUCKETS, contractPath } from "@/lib/paths";
import { uploadToBucket, validateFile } from "@/lib/upload";
import { formatBytes } from "@/lib/utils";
import { attachContractFileAction, createContractAction } from "@/server/actions/contracts";

export interface ClientOption {
  id: string;
  companyName: string;
}

export function ContractUploadModal({
  clients,
  defaultClientId,
  label = "Novo contrato",
}: {
  clients: ClientOption[];
  defaultClientId?: string;
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [title, setTitle] = useState("Contrato de Prestacao de Servicos");
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
    if (!file) {
      setError("Selecione o PDF do contrato.");
      return;
    }

    setBusy(true);

    try {
      const created = await createContractAction({ clientId, title, notes });
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

      const attached = await attachContractFileAction(contract.id, path);
      if (!attached.ok) {
        setError(attached.error);
        return;
      }

      toast.success("Contrato enviado ao cliente.");
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
        title="Enviar contrato"
        description="O cliente recebe o PDF para baixar, assinar e devolver assinado."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Enviar contrato
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

          <Field label="Nome do contrato" htmlFor="contract-title" required>
            <Input
              id="contract-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
            />
          </Field>

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
