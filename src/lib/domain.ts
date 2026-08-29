import type {
  ContentStatus,
  ContentType,
  ContractStatus,
  UserRole,
} from "@/types/database";

export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger";

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  awaiting_approval: "Aguardando aprovacao",
  approved: "Aprovado",
  revision_requested: "Alteracao solicitada",
  rejected: "Reprovado",
  published: "Publicado",
};

export const CONTENT_STATUS_TONE: Record<ContentStatus, BadgeTone> = {
  draft: "neutral",
  submitted: "info",
  awaiting_approval: "warning",
  approved: "success",
  revision_requested: "warning",
  rejected: "danger",
  published: "success",
};

export const CONTENT_STATUS_ORDER: ContentStatus[] = [
  "draft",
  "submitted",
  "awaiting_approval",
  "revision_requested",
  "rejected",
  "approved",
  "published",
];

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  image: "Imagem",
  video: "Video",
  carousel: "Carrossel",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  awaiting_signature: "Aguardando assinatura",
  signed: "Contrato enviado",
  under_review: "Aguardando conferencia",
  approved: "Aprovado",
  replaced: "Substituido",
};

export const CONTRACT_STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  awaiting_signature: "warning",
  signed: "info",
  under_review: "info",
  approved: "success",
  replaced: "neutral",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  professional: "Profissional",
  client: "Cliente",
};

/** Status em que o conteudo esta com o cliente. */
export const AWAITING_CLIENT_STATUSES: ContentStatus[] = ["submitted", "awaiting_approval"];

/** Status em que a bola esta com a equipe. */
export const NEEDS_TEAM_ACTION_STATUSES: ContentStatus[] = [
  "revision_requested",
  "rejected",
];

export const MAX_CAROUSEL_SLIDES = 10;
export const FEED_COLUMNS = 3;
export const FEED_ROWS = 10;
export const MAX_FEED_ITEMS = FEED_COLUMNS * FEED_ROWS;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export const ACCESS_CODE_PATTERN = /^[A-Z]{3}\d{4}$/;

export function isValidAccessCode(value: string): boolean {
  return ACCESS_CODE_PATTERN.test(value.trim().toUpperCase());
}
