"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateClientAvatarAction } from "@/server/actions/clients";
import type { Locale } from "@/lib/i18n/locale";
import { avatarPath, BUCKETS } from "@/lib/paths";
import { createImageThumbnail, uploadToBucket, validateFile } from "@/lib/upload";
import { cn, initials } from "@/lib/utils";

const COPY = {
  "pt-BR": { sending: "Enviando...", saved: "Foto atualizada.", failed: "Falha ao enviar a foto" },
  en: { sending: "Uploading...", saved: "Photo updated.", failed: "Failed to upload the photo" },
} as const;

/**
 * Foto de perfil circular, sobreposta a capa. O mesmo componente serve tanto
 * para a equipe editar a foto de qualquer cliente quanto para o cliente
 * editar a propria — a acao do servidor decide quem pode gravar o que.
 */
export function ClientAvatarUpload({
  clientId,
  name,
  avatarUrl,
  size = "size-16",
  locale = "pt-BR",
  onSaved,
}: {
  clientId: string;
  name: string;
  avatarUrl: string | null;
  size?: string;
  locale?: Locale;
  onSaved?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [busy, setBusy] = useState(false);
  const t = COPY[locale];

  async function handleFile(file: File) {
    const message = validateFile(file, "image", locale);
    if (message) {
      toast.error(message);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setBusy(true);

    try {
      const resized = (await createImageThumbnail(file, 400)) ?? file;
      const path = avatarPath(clientId, file.name);
      const uploadResult = await uploadToBucket(BUCKETS.profiles, path, resized, "image/jpeg");

      if (uploadResult.error) {
        toast.error(`${t.failed}: ${uploadResult.error}`);
        setPreview(avatarUrl);
        return;
      }

      const saved = await updateClientAvatarAction(clientId, path);
      if (!saved.ok) {
        toast.error(saved.error);
        setPreview(avatarUrl);
        return;
      }

      toast.success(t.saved);
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("group relative shrink-0 rounded-full", size)}>
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

      <span className="ring-surface flex size-full items-center justify-center overflow-hidden rounded-full bg-ink-100 text-sm font-semibold text-ink-600 ring-2">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="focus-ring absolute inset-0 flex items-center justify-center rounded-full bg-ink-900/0 text-white opacity-0 transition group-hover:bg-ink-900/40 group-hover:opacity-100"
        aria-label={locale === "en" ? "Change photo" : "Trocar foto"}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Camera className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
