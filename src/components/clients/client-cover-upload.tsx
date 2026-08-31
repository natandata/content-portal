"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { BUCKETS, clientCoverPath } from "@/lib/paths";
import { createImageThumbnail, uploadToBucket, validateFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { updateClientCoverAction } from "@/server/actions/clients";

/**
 * Banner de capa do cliente. Mostra a imagem atual (se houver) e, ao passar o
 * mouse ou tocar, revela o botao de trocar — a mesma imagem tambem aparece,
 * recortada de outro jeito, no card da galeria de Clientes.
 */
export function ClientCoverUpload({
  clientId,
  coverUrl,
  className,
}: {
  clientId: string;
  coverUrl: string | null;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(coverUrl);
  const [busy, setBusy] = useState(false);

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
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-line bg-ink-100",
        className,
      )}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-ink-100 to-ink-200">
          <Camera className="size-6 text-ink-400" aria-hidden />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

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

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={cn(
          "focus-ring absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-100",
          !preview && "opacity-100",
        )}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Camera className="size-3.5" aria-hidden />
        )}
        {busy ? "Enviando..." : preview ? "Trocar capa" : "Adicionar capa"}
      </button>
    </div>
  );
}
