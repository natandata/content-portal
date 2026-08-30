import type {
  ContentStatus,
  ContentType,
  ContractStatus,
  DocumentKind,
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
  signed: "Documento enviado",
  under_review: "Aguardando conferencia",
  approved: "Aprovado",
  replaced: "Substituido",
  delivered: "Entregue",
};

export const CONTRACT_STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  awaiting_signature: "warning",
  signed: "info",
  under_review: "info",
  approved: "success",
  replaced: "neutral",
  delivered: "success",
};

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  contract: "Contrato",
  strategy: "Estrategia de conteudo",
  brandbook: "Brandbook",
  mockup: "Mockup",
  other: "Outro documento",
};

/** Ordem em que os tipos aparecem no seletor. */
export const DOCUMENT_KINDS: DocumentKind[] = [
  "contract",
  "strategy",
  "brandbook",
  "mockup",
  "other",
];

/**
 * So contrato pede devolucao assinada; o resto e entrega. E apenas o padrao do
 * formulario — quem envia pode mudar.
 */
export function defaultRequiresSignature(kind: DocumentKind): boolean {
  return kind === "contract";
}

/** Titulo sugerido ao trocar o tipo, para nao ter que digitar do zero. */
export const DOCUMENT_KIND_DEFAULT_TITLE: Record<DocumentKind, string> = {
  contract: "Contrato de Prestacao de Servicos",
  strategy: "Estrategia de Conteudo",
  brandbook: "Brandbook",
  mockup: "Mockup",
  other: "",
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
export const MAX_HIGHLIGHTS = 10;

/** Abreviacao no estilo do Instagram: 1.2 mil, 34,5 mil, 1,2 mi. */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);

  if (value < 1_000_000) {
    const thousands = value / 1000;
    const label = thousands >= 100 ? Math.round(thousands) : Number(thousands.toFixed(1));
    return `${String(label).replace(".", ",")} mil`;
  }

  const millions = value / 1_000_000;
  const label = millions >= 100 ? Math.round(millions) : Number(millions.toFixed(1));
  return `${String(label).replace(".", ",")} mi`;
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export const ACCESS_CODE_PATTERN = /^[A-Z]{3}\d{4}$/;

export function isValidAccessCode(value: string): boolean {
  return ACCESS_CODE_PATTERN.test(value.trim().toUpperCase());
}

// ---------------------------------------------------------------------------
// Arquivos por link externo
// ---------------------------------------------------------------------------

/**
 * `file_type` gravado quando o arquivo nao esta no Storage e sim atras de um
 * link. Serve de sentinela para a UI escolher o card de link.
 */
export const LINK_FILE_TYPE = "link";

/** Provedores comuns, so para dar nome ao card em vez de mostrar o dominio cru. */
const LINK_PROVIDERS: [RegExp, string][] = [
  [/(^|\.)drive\.google\.com$/i, "Google Drive"],
  [/(^|\.)docs\.google\.com$/i, "Google Drive"],
  [/(^|\.)wetransfer\.com$/i, "WeTransfer"],
  [/(^|\.)we\.tl$/i, "WeTransfer"],
  [/(^|\.)1drv\.ms$/i, "OneDrive"],
  [/(^|\.)onedrive\.live\.com$/i, "OneDrive"],
  [/(^|\.)sharepoint\.com$/i, "OneDrive"],
  [/(^|\.)dropbox\.com$/i, "Dropbox"],
  [/(^|\.)youtube\.com$/i, "YouTube"],
  [/(^|\.)youtu\.be$/i, "YouTube"],
  [/(^|\.)vimeo\.com$/i, "Vimeo"],
  [/(^|\.)mega\.nz$/i, "MEGA"],
];

/**
 * Aceita apenas http(s) e devolve a URL normalizada — ou null.
 *
 * O filtro de protocolo e o ponto critico: esta string vira `href`, entao
 * `javascript:` e `data:` nao podem passar daqui (nem do CHECK no banco).
 */
export function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Sem esquema, assume https — colar "drive.google.com/..." e comum.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;

  return url.toString();
}

/** Nome amigavel do destino do link ("Google Drive", "meusite.com"...). */
export function linkProviderLabel(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "Link externo";
  }

  for (const [pattern, label] of LINK_PROVIDERS) {
    if (pattern.test(host)) return label;
  }

  return host.replace(/^www\./i, "");
}
