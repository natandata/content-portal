"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { BUCKETS, signedContractPath } from "@/lib/paths";
import { uploadToBucket, validateFile } from "@/lib/upload";
import { formatBytes } from "@/lib/utils";
import { submitSignedDocumentAction } from "@/server/actions/documents";

/** Envio do PDF assinado pelo proprio cliente. */
export function SignedDocumentUpload({
  contractId,
  clientId,
  alreadySent,
}: {
  contractId: string;
  clientId: string;
  alreadySent: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!file) {
      setError("Selecione o PDF assinado.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const path = signedContractPath(clientId, contractId, file.name);
      const upload = await uploadToBucket(
        BUCKETS.signedContracts,
        path,
        file,
        "application/pdf",
      );

      if (upload.error) {
        setError(`Nao foi possivel enviar o arquivo: ${upload.error}`);
        return;
      }

      const result = await submitSignedDocumentAction(contractId, path);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Documento assinado enviado.");
      setFile(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
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

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-800">{file.name}</p>
            <p className="text-xs text-ink-500">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            className="focus-ring shrink-0 rounded text-xs font-medium text-ink-500 hover:text-ink-900"
            onClick={() => setFile(null)}
            disabled={busy}
          >
            Trocar
          </button>
        </div>
      ) : (
        <Button
          variant="outline"
          fullWidth
          size="lg"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {alreadySent ? "Enviar novo arquivo assinado" : "Enviar documento assinado"}
        </Button>
      )}

      {file ? (
        <Button fullWidth size="lg" loading={busy} onClick={() => void send()}>
          Confirmar envio
        </Button>
      ) : null}

      <FormError>{error}</FormError>
    </div>
  );
}
