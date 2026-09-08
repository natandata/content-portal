"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileSignature } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { sendDocumentViaAutentiqueAction } from "@/server/actions/autentique-documents";

/** Terceira opcao de assinatura (ao lado de upload manual e Gov.br) -- envia o PDF original pro Autentique de verdade. */
export function AutentiqueSendModal({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function handleSend() {
    if (!name.trim() || !email.trim()) {
      toast.error("Informe nome e e-mail do signatario.");
      return;
    }
    setBusy(true);
    try {
      const result = await sendDocumentViaAutentiqueAction({
        contractId,
        signerName: name.trim(),
        signerEmail: email.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Documento enviado para assinatura via Autentique.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileSignature className="size-4" aria-hidden />
        Enviar via Autentique
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Enviar via Autentique"
        description="O signatario recebe um e-mail do Autentique com o link pra assinar -- o documento fecha sozinho aqui quando todos assinarem."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void handleSend()}>
              Enviar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="field-label" htmlFor="autentique-signer-name">
              Nome do signatario
            </label>
            <Input
              id="autentique-signer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="autentique-signer-email">
              E-mail do signatario
            </label>
            <Input
              id="autentique-signer-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              placeholder="nome@empresa.com"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
