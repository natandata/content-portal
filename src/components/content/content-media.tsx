"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileWarning } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { LINK_FILE_TYPE, linkProviderLabel } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { ContentType } from "@/types/database";

export interface MediaFile {
  id: string;
  url: string | null;
  fileType: string;
  position: number;
}

function Missing({ label }: { label: string }) {
  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-ink-100 text-ink-400">
      <FileWarning className="size-6" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/**
 * Arquivo hospedado fora do portal. Nao ha player: o cliente abre o link e
 * baixa na origem. `noopener noreferrer` porque o destino e digitado por
 * quem cadastra o conteudo.
 */
function ExternalCard({
  url,
  hostedLabel,
  openLabel,
}: {
  url: string;
  hostedLabel: string;
  openLabel: string;
}) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-ink-50 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface text-ink-500 shadow-sm">
        <ExternalLink className="size-5" aria-hidden />
      </span>

      <div>
        <p className="text-sm font-medium text-ink-900">{linkProviderLabel(url)}</p>
        <p className="mt-1 text-xs text-ink-500">{hostedLabel}</p>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-on-ink transition hover:bg-ink-800"
      >
        <ExternalLink className="size-4" aria-hidden />
        {openLabel}
      </a>

      <p className="max-w-full truncate text-[11px] text-ink-400">{url}</p>
    </div>
  );
}

function Slide({
  file,
  title,
  t,
}: {
  file: MediaFile;
  title: string;
  t: ReturnType<typeof getDictionary>["media"];
}) {
  if (!file.url) return <Missing label={t.unavailable} />;

  if (file.fileType === LINK_FILE_TYPE) {
    return <ExternalCard url={file.url} hostedLabel={t.hostedExternally} openLabel={t.openLink} />;
  }

  if (file.fileType.startsWith("video/")) {
    return (
      <video
        controls
        preload="metadata"
        playsInline
        className="max-h-[70dvh] w-full bg-black object-contain"
      >
        <source src={file.url} type={file.fileType} />
        {t.videoUnsupported}
      </video>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={file.url}
      alt={title}
      className="max-h-[70dvh] w-full bg-ink-100 object-contain"
    />
  );
}

export function ContentMedia({
  files,
  type,
  title,
  locale = DEFAULT_LOCALE,
}: {
  files: MediaFile[];
  type: ContentType;
  title: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale).media;
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const total = files.length;

  const scrollTo = useCallback((target: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(target, track.children.length - 1));
    const child = track.children[clamped] as HTMLElement | undefined;
    if (child) track.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const width = track.clientWidth || 1;
      setIndex(Math.round(track.scrollLeft / width));
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  if (total === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-line">
        <Missing label={t.unavailable} />
      </div>
    );
  }

  if (type !== "carousel" || total === 1) {
    const file = files[0];
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {file ? <Slide file={file} title={title} t={t} /> : <Missing label={t.unavailable} />}
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface">
        <div
          ref={trackRef}
          className="scroll-slim flex snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {files.map((file) => (
            <div key={file.id} className="w-full shrink-0 snap-center">
              <Slide file={file} title={`${title} — slide ${file.position}`} t={t} />
            </div>
          ))}
        </div>

        <IconButton
          label={t.previousSlide}
          onClick={() => scrollTo(index - 1)}
          disabled={index === 0}
          className="absolute top-1/2 left-2 -translate-y-1/2 bg-surface/90 shadow-sm backdrop-blur hover:bg-surface"
        >
          <ChevronLeft className="size-5" />
        </IconButton>

        <IconButton
          label={t.nextSlide}
          onClick={() => scrollTo(index + 1)}
          disabled={index >= total - 1}
          className="absolute top-1/2 right-2 -translate-y-1/2 bg-surface/90 shadow-sm backdrop-blur hover:bg-surface"
        >
          <ChevronRight className="size-5" />
        </IconButton>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5">
          {files.map((file, position) => (
            <button
              key={file.id}
              type="button"
              aria-label={t.goToSlide(position + 1)}
              onClick={() => scrollTo(position)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                position === index ? "w-5 bg-ink-800" : "w-1.5 bg-ink-300",
              )}
            />
          ))}
        </div>
        <span className="text-xs tabular-nums text-ink-500">
          {t.slideOf(Math.min(index + 1, total), total)}
        </span>
      </div>
    </div>
  );
}
