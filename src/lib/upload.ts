"use client";

import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  MAX_VIDEO_BYTES,
} from "@/lib/domain";
import type { BucketName } from "@/lib/paths";
import { createClient } from "@/lib/supabase/client";
import { formatBytes } from "@/lib/utils";

export type UploadKind = "image" | "video" | "pdf";

/** Validacao no browser; o Storage tambem impoe tipo e tamanho por bucket. */
export function validateFile(file: File, kind: UploadKind): string | null {
  if (kind === "pdf") {
    if (file.type !== "application/pdf") return "Envie um arquivo PDF.";
    if (file.size > MAX_PDF_BYTES) {
      return `O PDF excede o limite de ${formatBytes(MAX_PDF_BYTES)}.`;
    }
    return null;
  }

  if (kind === "image") {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return "Formatos aceitos: JPG, PNG ou WEBP.";
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return `A imagem excede o limite de ${formatBytes(MAX_IMAGE_BYTES)}.`;
    }
    return null;
  }

  if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    return "Formatos aceitos: MP4, MOV ou WEBM.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `O video excede o limite de ${formatBytes(MAX_VIDEO_BYTES)}.`;
  }
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
}

function drawContained(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxSize: number,
): HTMLCanvasElement | null {
  if (!width || !height) return null;

  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Miniatura JPEG de uma imagem, gerada no browser. */
export async function createImageThumbnail(file: File, maxSize = 900): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();

    const canvas = drawContained(image, image.naturalWidth, image.naturalHeight, maxSize);
    if (!canvas) return null;
    return await canvasToBlob(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Miniatura a partir do primeiro frame do video. */
export async function createVideoThumbnail(file: File, maxSize = 900): Promise<Blob | null> {
  const url = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    const frame = await new Promise<HTMLVideoElement | null>((resolve) => {
      const timeout = window.setTimeout(() => resolve(null), 8000);

      const finish = (value: HTMLVideoElement | null) => {
        window.clearTimeout(timeout);
        resolve(value);
      };

      video.onloadeddata = () => {
        // Alguns codecs entregam o frame 0 vazio; buscamos um pouco a frente.
        const target = Math.min(0.2, Math.max(0, (video.duration || 1) / 2));
        video.currentTime = target;
      };
      video.onseeked = () => finish(video);
      video.onerror = () => finish(null);
    });

    if (!frame) return null;

    const canvas = drawContained(frame, frame.videoWidth, frame.videoHeight, maxSize);
    if (!canvas) return null;
    return await canvasToBlob(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function createThumbnail(file: File): Promise<Blob | null> {
  if (file.type.startsWith("image/")) return createImageThumbnail(file);
  if (file.type.startsWith("video/")) return createVideoThumbnail(file);
  return null;
}

export interface UploadResult {
  path: string;
  error: string | null;
}

/** Upload direto do browser para o Storage — sujeito as policies do bucket. */
export async function uploadToBucket(
  bucket: BucketName,
  path: string,
  body: File | Blob,
  contentType?: string,
): Promise<UploadResult> {
  const supabase = createClient();

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    upsert: false,
    contentType: contentType ?? (body instanceof File ? body.type : "application/octet-stream"),
  });

  if (error) {
    return { path, error: error.message };
  }

  return { path, error: null };
}
