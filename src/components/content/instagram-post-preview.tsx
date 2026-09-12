"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send, User } from "lucide-react";

import { Missing, Slide, type MediaFile } from "@/components/content/content-media";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { ContentType } from "@/types/database";

/**
 * Moldura de post do Instagram (cabecalho com @, mídia, icones de acao,
 * legenda) -- so pra aprovacao do cliente enxergar como vai ficar de
 * verdade. Reaproveita `Slide` de `content-media.tsx` pra imagem/video/link
 * (mesma logica de carrossel), mas com o layout e a posicao das bolinhas
 * igual o app do Instagram (entre a midia e a fileira de icones, ativa em
 * azul) em vez do carrossel generico usado no resto do portal.
 *
 * So decorativo: coracao/comentario/compartilhar/salvar nao sao clicaveis,
 * e nao existe "curtido por" -- inventar numero de curtida seria dado falso.
 */
export function InstagramPostPreview({
  files,
  type,
  title,
  caption,
  username,
  avatarUrl,
  locale = DEFAULT_LOCALE,
}: {
  files: MediaFile[];
  type: ContentType;
  title: string;
  caption: string | null;
  username: string;
  avatarUrl: string | null;
  locale?: Locale;
}) {
  const t = getDictionary(locale).media;
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const total = files.length;
  const isCarousel = type === "carousel" && total > 1;

  const scrollTo = useCallback((target: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(target, track.children.length - 1));
    const child = track.children[clamped] as HTMLElement | undefined;
    if (child) track.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!isCarousel) return;
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const width = track.clientWidth || 1;
      setIndex(Math.round(track.scrollLeft / width));
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [isCarousel]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* Cabecalho: avatar + @usuario + "..." -- igual o topo de um post real. */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="size-8 shrink-0 overflow-hidden rounded-full bg-ink-100 ring-1 ring-line">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-ink-300">
              <User className="size-4" aria-hidden />
            </div>
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{username}</span>
        <MoreHorizontal className="size-5 shrink-0 text-ink-700" aria-hidden />
      </div>

      {/* Midia -- carrossel usa a mesma logica de scroll-snap do resto do portal. */}
      {total === 0 ? (
        <Missing label={t.unavailable} />
      ) : !isCarousel ? (
        (() => {
          const file = files[0];
          return file ? <Slide file={file} title={title} t={t} /> : <Missing label={t.unavailable} />;
        })()
      ) : (
        <div
          ref={trackRef}
          className="scroll-slim flex snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {files.map((file) => (
            <div key={file.id} className="w-full shrink-0 snap-center">
              <Slide file={file} title={`${title} — ${file.position}`} t={t} />
            </div>
          ))}
        </div>
      )}

      {/* Bolinhas do carrossel -- ativa em azul, igual o app de verdade. */}
      {isCarousel ? (
        <div className="flex items-center justify-center gap-1.5 py-2">
          {files.map((file, position) => (
            <button
              key={file.id}
              type="button"
              onClick={() => scrollTo(position)}
              aria-label={t.goToSlide(position + 1)}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                position === index ? "bg-[#0095F6]" : "bg-ink-200",
              )}
            />
          ))}
        </div>
      ) : null}

      {/* Fileira de icones -- so visual, nao clicavel de proposito (sem curtida/comentario de verdade aqui). */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-3.5">
          <Heart className="size-6 text-ink-900" aria-hidden />
          <MessageCircle className="size-6 -scale-x-100 text-ink-900" aria-hidden />
          <Send className="size-6 text-ink-900" aria-hidden />
        </div>
        <Bookmark className="size-6 text-ink-900" aria-hidden />
      </div>

      {caption ? (
        <p className="px-3 pb-3 text-sm text-ink-900">
          <span className="font-semibold">{username}</span> <span className="whitespace-pre-wrap">{caption}</span>
        </p>
      ) : null}
    </div>
  );
}
