import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/*
 * Fuso fixo, de proposito. Estas datas sao formatadas no servidor, e o servidor
 * da Vercel roda em UTC — sem fixar aqui, o historico aparecia 3 horas adiantado
 * em producao e certo em desenvolvimento. Fixar tambem mantem servidor e cliente
 * gerando exatamente o mesmo texto, sem divergencia de hidratacao.
 */
export const APP_TIME_ZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

/** AAAA-MM-DD no fuso do app, para comparar dias de calendario. */
const isoDayFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: APP_TIME_ZONE,
});

function calendarDay(date: Date): number {
  const [year, month, day] = isoDayFormatter.format(date).split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / 86_400_000;
}

/** Datas puras (`date` do Postgres) nao devem sofrer conversao de fuso. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const isPlainDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  // Meio-dia UTC como ancora: longe o bastante das bordas para nenhum fuso
  // empurrar a data para o dia anterior ou seguinte.
  const date = isPlainDate ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatRelativeDay(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  // Diferenca em dias de calendario no fuso do app — nao em blocos de 24h.
  const diffDays = calendarDay(new Date()) - calendarDay(date);

  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Ha ${diffDays} dias`;
  return formatDate(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Remove acentos, espacos e caracteres perigosos de um nome de arquivo. */
export function safeFileName(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return normalized.length > 80 ? normalized.slice(-80) : normalized;
}

export function fileExtension(name: string, fallback = "bin"): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(name);
  return match?.[1]?.toLowerCase() ?? fallback;
}
