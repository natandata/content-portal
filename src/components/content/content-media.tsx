"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileWarning } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ContentType } from "@/types/database";

export interface MediaFile {
  id: string;
  url: string | null;
  fileType: string;
  position: number;
}

function Missing() {
  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-ink-100 text-ink-400">
      <FileWarning className="size-6" aria-hidden />
      <p className="text-sm">Arquivo indisponivel</p>
    </div>
  );
}

function Slide({ file, title }: { file: MediaFile; title: string }) {
  if (!file.url) return <Missing />;

  if (file.fileType.startsWith("video/")) {
    return (
      <video
        controls
        preload="metadata"
        playsInline
        className="max-h-[70dvh] w-full bg-black object-contain"
      >
        <source src={file.url} type={file.fileType} />
        Seu navegador nao consegue reproduzir este video.
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
}: {
  files: MediaFile[];
  type: ContentType;
  title: string;
}) {
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
        <Missing />
      </div>
    );
  }

  if (type !== "carousel" || total === 1) {
    const file = files[0];
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {file ? <Slide file={file} title={title} /> : <Missing />}
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
              <Slide file={file} title={`${title} — slide ${file.position}`} />
            </div>
          ))}
        </div>

        <IconButton
          label="Slide anterior"
          onClick={() => scrollTo(index - 1)}
          disabled={index === 0}
          className="absolute top-1/2 left-2 -translate-y-1/2 bg-surface/90 shadow-sm backdrop-blur hover:bg-surface"
        >
          <ChevronLeft className="size-5" />
        </IconButton>

        <IconButton
          label="Proximo slide"
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
              aria-label={`Ir para o slide ${position + 1}`}
              onClick={() => scrollTo(position)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                position === index ? "w-5 bg-ink-800" : "w-1.5 bg-ink-300",
              )}
            />
          ))}
        </div>
        <span className="text-xs tabular-nums text-ink-500">
          Slide {Math.min(index + 1, total)}/{total}
        </span>
      </div>
    </div>
  );
}
