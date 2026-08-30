"use client";

import { useState } from "react";
import { Eye, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/**
 * Le o PDF sem sair da tela. O iframe cobre desktop e Android; no iOS o Safari
 * costuma recusar PDF em iframe, por isso o link de abrir em outra aba fica
 * sempre visivel, e nao so quando algo falha.
 */
export function DocumentPreview({
  url,
  title,
  label = "Pre-visualizar",
  variant = "outline",
  fullWidth,
}: {
  url: string;
  title: string;
  label?: string;
  variant?: "outline" | "secondary" | "primary";
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        fullWidth={fullWidth}
        className={cn(fullWidth && "h-12")}
        onClick={() => setOpen(true)}
      >
        <Eye className="size-4" aria-hidden />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size="xl"
        footer={
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-700 transition hover:text-ink-900"
            >
              <ExternalLink className="size-4" aria-hidden />
              Abrir em nova aba
            </a>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </>
        }
      >
        <div className="overflow-hidden rounded-lg border border-line bg-ink-100">
          <iframe
            src={url}
            title={title}
            className="h-[68dvh] w-full"
            /*
             * Sem `sandbox`: o visualizador de PDF do navegador e uma extensao
             * e nao carrega dentro de um iframe sandboxed — o quadro fica em
             * branco com qualquer combinacao de tokens. O risco e baixo: o
             * documento vem de outra origem (o Storage), roda no processo
             * isolado do proprio leitor e nao alcanca esta pagina.
             */
            referrerPolicy="no-referrer"
          />
        </div>
      </Modal>
    </>
  );
}
