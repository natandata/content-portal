import { Clapperboard, Grid3x3, Layers, Play } from "lucide-react";

import { MAX_FEED_ITEMS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { ContentType } from "@/types/database";

export interface FeedEntry {
  feedItemId: string;
  contentId: string;
  title: string;
  type: ContentType;
  previewUrl: string | null;
  position: number;
}

/**
 * Grade 3x10 somente leitura. `fill` completa as 30 posicoes com celulas vazias
 * (visao de composicao do feed); a aba de reels usa `fill={false}`, ja que ali
 * so existe o que existe.
 */
export function FeedGrid({
  entries,
  fill = true,
  emptyLabel,
  highlightId,
}: {
  entries: FeedEntry[];
  fill?: boolean;
  emptyLabel?: string;
  /** Marca uma celula como "novo" — usado na previa de publicacao. */
  highlightId?: string;
}) {
  const emptySlots = fill ? Math.max(0, MAX_FEED_ITEMS - entries.length) : 0;

  if (entries.length === 0 && !fill) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-ink-400">
        <Clapperboard className="size-6" aria-hidden />
        <p className="text-sm">{emptyLabel ?? "Nada por aqui ainda."}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
      {entries.map((entry) => (
        <figure
          key={entry.feedItemId}
          className={cn(
            "relative aspect-square overflow-hidden bg-ink-100",
            entry.contentId === highlightId && "ring-2 ring-accent ring-inset",
          )}
        >
          {entry.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.previewUrl}
              alt={entry.title}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-ink-300">
              <Grid3x3 className="size-5" aria-hidden />
            </div>
          )}

          {entry.contentId === highlightId ? (
            <span className="absolute top-1 left-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
              novo
            </span>
          ) : null}

          {entry.type !== "image" ? (
            <span className="absolute top-1.5 right-1.5 text-white drop-shadow">
              {entry.type === "video" ? (
                <Play className="size-4 fill-current" aria-hidden />
              ) : (
                <Layers className="size-4" aria-hidden />
              )}
            </span>
          ) : null}
        </figure>
      ))}

      {Array.from({ length: emptySlots }).map((_, index) => (
        <div
          key={`empty-${index}`}
          className={cn(
            "aspect-square border border-dashed border-line bg-ink-50/60",
            index === 0 && entries.length === 0 && "col-span-1",
          )}
        />
      ))}
    </div>
  );
}
