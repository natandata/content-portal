"use client";

import { Download } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";

/**
 * Baixa os arquivos de um post de uma vez -- pra facilitar o profissional
 * baixar o conteudo aprovado e publicar manualmente. As URLs ja vem com
 * download forcado (`Content-Disposition: attachment`, ver
 * `loadContentDownloadFiles`), entao um unico arquivo basta um link normal;
 * com mais de um (carrossel), dispara os downloads em sequencia -- o
 * navegador bloqueia varios `window.open`/clique simultaneos se disparados
 * juntos.
 */
export function DownloadContentButton({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  const [singleUrl] = urls;
  if (singleUrl && urls.length === 1) {
    return (
      <LinkButton
        href={singleUrl}
        target="_blank"
        rel="noreferrer"
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Download className="size-4" aria-hidden />
        Baixar
      </LinkButton>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => {
        urls.forEach((url, index) => {
          window.setTimeout(() => {
            const link = document.createElement("a");
            link.href = url;
            link.rel = "noreferrer";
            document.body.appendChild(link);
            link.click();
            link.remove();
          }, index * 350);
        });
      }}
    >
      <Download className="size-4" aria-hidden />
      Baixar ({urls.length})
    </Button>
  );
}
