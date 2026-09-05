import type { Locale } from "@/lib/i18n/locale";
import type {
  BrandArchetype,
  ContentStatus,
  ContentType,
  ContractStatus,
  CurrencyCode,
  DocumentKind,
  InvoiceMethod,
  InvoiceStatus,
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

/** Os 12 arquetipos de marca classicos (Mark & Pearson) usados no Branding do cliente. */
export const BRAND_ARCHETYPE_LABEL: Record<BrandArchetype, string> = {
  heroi: "Heroi",
  mago: "Mago",
  sabio: "Sabio",
  criador: "Criador",
  governante: "Governante",
  cara_comum: "Cara Comum",
  amante: "Amante",
  prestativo: "Prestativo",
  inocente: "Inocente",
  explorador: "Explorador",
  rebelde: "Rebelde",
  bobo_da_corte: "Bobo da Corte",
};

export const BRAND_ARCHETYPES: BrandArchetype[] = [
  "heroi",
  "mago",
  "sabio",
  "criador",
  "governante",
  "cara_comum",
  "amante",
  "prestativo",
  "inocente",
  "explorador",
  "rebelde",
  "bobo_da_corte",
];

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
/**
 * "en" usa o padrao do proprio Instagram (K/M, ponto decimal); pt-BR mantem
 * "mil"/"mi" com virgula, que e como a rede social fala com o brasileiro.
 */
export function formatCount(value: number, locale: "pt-BR" | "en" = "pt-BR"): string {
  if (value < 1000) return String(value);

  const isEn = locale === "en";

  if (value < 1_000_000) {
    const thousands = value / 1000;
    const label = thousands >= 100 ? Math.round(thousands) : Number(thousands.toFixed(1));
    return isEn ? `${label}K` : `${String(label).replace(".", ",")} mil`;
  }

  const millions = value / 1_000_000;
  const label = millions >= 100 ? Math.round(millions) : Number(millions.toFixed(1));
  return isEn ? `${label}M` : `${String(label).replace(".", ",")} mi`;
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

// ---------------------------------------------------------------------------
// Assinatura via Gov.br
// ---------------------------------------------------------------------------

/**
 * Assinador de documentos do ITI (Instituto Nacional de Tecnologia da
 * Informacao), o mesmo orgao que emite o certificado do gov.br. Aceita login
 * com conta gov.br e assina o PDF que a pessoa enviar por la.
 *
 * Nao ha API publica para abrir ja com o arquivo carregado nem para receber o
 * PDF assinado de volta automaticamente — isso exigiria integracao
 * credenciada com o ITI. O botao e um redirecionamento de conveniencia: abre
 * o assinador oficial em nova aba: o cliente baixa o PDF aqui, assina la, e
 * devolve pelo upload de documento assinado que ja existe nesta tela.
 */
export const GOV_BR_ASSINADOR_URL = "https://assinador.iti.br/";

// ---------------------------------------------------------------------------
// Cobrancas (pagamentos)
// ---------------------------------------------------------------------------

export const CURRENCIES: CurrencyCode[] = ["BRL", "USD", "EUR", "GBP"];

export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  BRL: "Real (R$)",
  USD: "Dolar (US$)",
  EUR: "Euro (€)",
  GBP: "Libra esterlina (£)",
};

export const INVOICE_METHODS: InvoiceMethod[] = ["boleto", "link", "pix", "stripe"];

export const INVOICE_METHOD_LABEL: Record<InvoiceMethod, string> = {
  boleto: "Boleto",
  link: "Link de pagamento",
  pix: "Chave Pix",
  // Os tres acima o profissional resolve por fora; neste o cliente paga dentro
  // do portal e a cobranca se marca como paga sozinha.
  stripe: "Pagamento online",
};

const INVOICE_METHOD_LABEL_EN: Record<InvoiceMethod, string> = {
  boleto: "Boleto",
  link: "Payment link",
  pix: "Pix key",
  stripe: "Online payment",
};

/**
 * Mesmo rotulo que `INVOICE_METHOD_LABEL`, mas no idioma certo — a tela do
 * cliente e a unica que precisa disso; a da equipe fica so em portugues.
 */
export function invoiceMethodLabelFor(method: InvoiceMethod, locale: Locale): string {
  return locale === "en" ? INVOICE_METHOD_LABEL_EN[method] : INVOICE_METHOD_LABEL[method];
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: "Em aberto",
  paid: "Paga",
};

/** Valor formatado na moeda certa — cada moeda com seu proprio simbolo, sempre. */
export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: "pt-BR" | "en" = "pt-BR",
): string {
  const intlLocale = currency === "BRL" ? "pt-BR" : locale === "en" ? "en-US" : "pt-BR";
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency }).format(amount);
}

/**
 * Dias entre hoje (no fuso do app) e uma data pura (`date` do Postgres).
 * Positivo = ainda vai vencer, zero = vence hoje, negativo = ja venceu.
 */
export function daysUntil(dateValue: string): number {
  const anchor = new Date(`${dateValue}T12:00:00Z`);
  const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())}T12:00:00Z`);
  return Math.round((anchor.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Rotulo curto do prazo — usado no badge de status da cobranca. `locale`
 * default pt-BR: a listagem da equipe nunca passa, so a do cliente.
 */
export function dueDateLabel(
  dateValue: string,
  status: InvoiceStatus,
  locale: Locale = "pt-BR",
): { text: string; tone: BadgeTone } {
  const en = locale === "en";

  if (status === "paid") return { text: en ? "Paid" : "Paga", tone: "success" };

  const diff = daysUntil(dateValue);
  if (diff < 0) {
    const days = Math.abs(diff);
    return {
      text: en ? `Overdue ${days} day${days === 1 ? "" : "s"}` : `Vencida ha ${days} dia${days === 1 ? "" : "s"}`,
      tone: "danger",
    };
  }
  if (diff === 0) return { text: en ? "Due today" : "Vence hoje", tone: "warning" };
  if (diff <= 5) {
    return {
      text: en ? `Due in ${diff} day${diff === 1 ? "" : "s"}` : `Vence em ${diff} dia${diff === 1 ? "" : "s"}`,
      tone: "warning",
    };
  }
  return { text: en ? "Open" : "Em aberto", tone: "neutral" };
}
