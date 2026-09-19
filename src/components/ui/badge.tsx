import type { ReactNode } from "react";

import {
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_TONE,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  type BadgeTone,
} from "@/lib/domain";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { ContentStatus, ContractStatus } from "@/types/database";

// Duas camadas (tinta suave + texto de alto contraste), com um pontinho na
// cor "cheia" na frente -- mesmo padrao de badge de status do redesign
// aprovado. No escuro os tons pastel viram manchas claras: cada um ganha um
// par proprio.
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-600 dark:bg-ink-100 dark:text-ink-600",
  info: "bg-accent-soft text-accent",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300",
};

const DOTS: Record<BadgeTone, string> = {
  neutral: "bg-ink-400",
  info: "bg-accent",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = true,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  /** Pontinho de 6px antes do texto -- desliga em badges muito pequenos/apertados. */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 shrink-0 rounded-full", DOTS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function ContentStatusBadge({
  status,
  locale = DEFAULT_LOCALE,
  className,
}: {
  status: ContentStatus;
  locale?: Locale;
  className?: string;
}) {
  const label = locale === DEFAULT_LOCALE ? CONTENT_STATUS_LABEL[status] : getDictionary(locale).status.content[status];
  return (
    <Badge tone={CONTENT_STATUS_TONE[status]} className={className}>
      {label}
    </Badge>
  );
}

export function ContractStatusBadge({
  status,
  locale = DEFAULT_LOCALE,
  className,
}: {
  status: ContractStatus;
  locale?: Locale;
  className?: string;
}) {
  const label = locale === DEFAULT_LOCALE ? CONTRACT_STATUS_LABEL[status] : getDictionary(locale).status.document[status];
  return (
    <Badge tone={CONTRACT_STATUS_TONE[status]} className={className}>
      {label}
    </Badge>
  );
}
