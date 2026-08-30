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

/*
 * `locale` aqui e opcional e default "pt-BR" de proposito: toda chamada ja
 * existente na area da equipe continua igual sem tocar em nenhum arquivo. So
 * a area do cliente passa "en" quando o visitante escolheu ingles.
 */
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatterFor(locale: string): Intl.DateTimeFormat {
  let formatter = dateFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: APP_TIME_ZONE,
    });
    dateFormatterCache.set(locale, formatter);
  }
  return formatter;
}

function dateTimeFormatterFor(locale: string): Intl.DateTimeFormat {
  let formatter = dateTimeFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    });
    dateTimeFormatterCache.set(locale, formatter);
  }
  return formatter;
}

/** AAAA-MM-DD no fuso do app, para comparar dias de calendario — independe de locale. */
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
export function formatDate(value: string | null | undefined, locale = "pt-BR"): string {
  if (!value) return "—";
  const isPlainDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  // Meio-dia UTC como ancora: longe o bastante das bordas para nenhum fuso
  // empurrar a data para o dia anterior ou seguinte.
  const date = isPlainDate ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatterFor(locale).format(date);
}

export function formatDateTime(value: string | null | undefined, locale = "pt-BR"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatterFor(locale).format(date);
}

export function formatRelativeDay(
  value: string | null | undefined,
  locale = "pt-BR",
  labels: { today: string; yesterday: string; daysAgo: (n: number) => string } = {
    today: "Hoje",
    yesterday: "Ontem",
    daysAgo: (n) => `Ha ${n} dias`,
  },
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  // Diferenca em dias de calendario no fuso do app — nao em blocos de 24h.
  const diffDays = calendarDay(new Date()) - calendarDay(date);

  if (diffDays <= 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  if (diffDays < 7) return labels.daysAgo(diffDays);
  return formatDate(value, locale);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
