import { ExternalLink, ShieldCheck } from "lucide-react";

import { GOV_BR_ASSINADOR_URL } from "@/lib/domain";

/**
 * Atalho para o assinador oficial do governo (ITI), nao uma integracao.
 *
 * Nao existe API publica para abrir o assinador ja com este PDF carregado, nem
 * para receber de volta o arquivo assinado automaticamente — isso exigiria
 * credenciamento com o ITI. O botao so abre o site em outra aba; o cliente
 * ainda baixa o PDF aqui do lado e devolve o assinado pelo upload abaixo.
 */
export function GovBrSignatureButton() {
  return (
    <div className="rounded-lg border border-line bg-ink-50/60 px-3 py-3">
      <a
        href={GOV_BR_ASSINADOR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1351b4] px-4 text-sm font-medium text-white transition hover:bg-[#0c4085]"
      >
        <ShieldCheck className="size-4" aria-hidden />
        Assinar com Gov.br
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
      <p className="mt-2 text-xs text-ink-500">
        Abre o assinador oficial do governo em outra aba. Baixe o documento acima, assine por
        la com sua conta Gov.br e depois envie o arquivo assinado aqui embaixo.
      </p>
    </div>
  );
}
