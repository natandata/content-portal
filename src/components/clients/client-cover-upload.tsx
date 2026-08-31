"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Check, Loader2, Move, X } from "lucide-react";
import { toast } from "sonner";

import { BUCKETS, clientCoverPath } from "@/lib/paths";
import { createImageThumbnail, uploadToBucket, validateFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { updateClientCoverAction, updateClientCoverPositionAction } from "@/server/actions/clients";

/**
 * Banner de capa do cliente. Mostra a imagem atual (se houver) e, ao passar o
 * mouse ou tocar, revela os botoes de trocar e ajustar — a mesma imagem
 * tambem aparece, recortada de outro jeito, no card da galeria de Clientes.
 * "Ajustar" arrasta o recorte na vertical; o ponto salvo vale para os dois
 * lugares.
 */
export function ClientCoverUpload({
  clientId,
  coverUrl,
  coverPositionY,
  className,
}: {
  clientId: string;
  coverUrl: string | null;
  coverPositionY: number;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startPosition: number } | null>(null);

  const [preview, setPreview] = useState<string | null>(coverUrl);
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [positionY, setPositionY] = useState(coverPositionY);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    const message = validateFile(file, "image");
    if (message) {
      toast.error(message);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setBusy(true);

    try {
      // Capa aparece grande no topo da tela do cliente: mantem qualidade maior que o avatar.
      const resized = (await createImageThumbnail(file, 1600)) ?? file;
      const path = clientCoverPath(clientId, file.name);
      const uploadResult = await uploadToBucket(BUCKETS.profiles, path, resized, "image/jpeg");

      if (uploadResult.error) {
        toast.error(`Falha ao enviar a capa: ${uploadResult.error}`);
        setPreview(coverUrl);
        return;
      }

      const saved = await updateClientCoverAction(clientId, path);
      if (!saved.ok) {
        toast.error(saved.error);
        setPreview(coverUrl);
        return;
      }

      toast.success("Capa atualizada.");
      setPositionY(50);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function startAdjust() {
    setPositionY(coverPositionY);
    setAdjusting(true);
  }

  function cancelAdjust() {
    setPositionY(coverPositionY);
    setAdjusting(false);
  }

  async function saveAdjust() {
    setBusy(true);
    try {
      const result = await updateClientCoverPositionAction(clientId, positionY);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Posicao da capa salva.");
      setAdjusting(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!adjusting) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragState.current = { startY: event.clientY, startPosition: positionY };
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!adjusting || !dragState.current || !containerRef.current) return;
    const height = containerRef.current.offsetHeight || 1;
    // Arrastar a imagem para baixo revela o topo dela — por isso o sinal invertido.
    const delta = ((event.clientY - dragState.current.startY) / height) * 100;
    const next = Math.round(Math.min(100, Math.max(0, dragState.current.startPosition - delta)));
    setPositionY(next);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    dragState.current = null;
    setDragging(false);
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn(
        "group relative touch-none overflow-hidden rounded-xl border border-line bg-ink-100 select-none",
        adjusting && (dragging ? "cursor-grabbing" : "cursor-grab"),
        className,
      )}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          draggable={false}
          className="size-full object-cover"
          style={{ objectPosition: `50% ${positionY}%` }}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-ink-100 to-ink-200">
          <Camera className="size-6 text-ink-400" aria-hidden />
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/50 via-transparent to-transparent transition",
          adjusting ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />

      {adjusting ? (
        <>
          <span className="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            <Move className="size-3.5" aria-hidden />
            Arraste para ajustar
          </span>

          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <button
              type="button"
              onClick={cancelAdjust}
              disabled={busy}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-ink-900/90"
            >
              <X className="size-3.5" aria-hidden />
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void saveAdjust()}
              disabled={busy}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-ink backdrop-blur transition hover:opacity-90"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="size-3.5" aria-hidden />
              )}
              Salvar posicao
            </button>
          </div>
        </>
      ) : (
        <div
          className={cn(
            "absolute right-3 bottom-3 flex items-center gap-2 opacity-0 transition",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            !preview && "opacity-100",
          )}
        >
          {preview ? (
            <button
              type="button"
              onClick={startAdjust}
              disabled={busy}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-ink-900/90"
            >
              <Move className="size-3.5" aria-hidden />
              Ajustar
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-ink-900/90"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Camera className="size-3.5" aria-hidden />
            )}
            {busy ? "Enviando..." : preview ? "Trocar capa" : "Adicionar capa"}
          </button>
        </div>
      )}
    </div>
  );
}
