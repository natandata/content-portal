import { Images, Layers, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ContentType } from "@/types/database";

/**
 * Capa de um conteudo. Usa `img` (e nao next/image) porque as URLs sao
 * assinadas e temporarias — otimizar no servidor invalidaria a assinatura.
 */
export function ContentThumb({
  url,
  type,
  alt,
  className,
  rounded = "rounded-xl",
}: {
  url: string | null;
  type: ContentType;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-ink-100",
        rounded,
        className ?? "size-20",
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-ink-300">
          <Images className="size-6" aria-hidden />
        </div>
      )}

      {type === "video" ? (
        <span className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-ink-900/75 text-white">
          <Play className="size-3 fill-current" aria-hidden />
          <span className="sr-only">Video</span>
        </span>
      ) : null}

      {type === "carousel" ? (
        <span className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-ink-900/75 text-white">
          <Layers className="size-3.5" aria-hidden />
          <span className="sr-only">Carrossel</span>
        </span>
      ) : null}
    </div>
  );
}
