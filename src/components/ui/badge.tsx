import type { ReactNode } from "react";

import {
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_TONE,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  type BadgeTone,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { ContentStatus, ContractStatus } from "@/types/database";

// No escuro os tons pastel viram manchas claras: cada um ganha um par proprio.
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-600 ring-ink-200",
  info: "bg-accent-soft text-accent ring-accent/20",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/12 dark:text-amber-300 dark:ring-amber-400/25",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/12 dark:text-emerald-300 dark:ring-emerald-400/25",
  danger:
    "bg-red-50 text-red-700 ring-red-200 dark:bg-red-400/12 dark:text-red-300 dark:ring-red-400/25",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ContentStatusBadge({
  status,
  className,
}: {
  status: ContentStatus;
  className?: string;
}) {
  return (
    <Badge tone={CONTENT_STATUS_TONE[status]} className={className}>
      {CONTENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ContractStatusBadge({
  status,
  className,
}: {
  status: ContractStatus;
  className?: string;
}) {
  return (
    <Badge tone={CONTRACT_STATUS_TONE[status]} className={className}>
      {CONTRACT_STATUS_LABEL[status]}
    </Badge>
  );
}
