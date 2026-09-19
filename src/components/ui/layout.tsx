import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumb ? <div className="mb-2">{breadcrumb}</div> : null}
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("card", padded && "p-5", className)}>{children}</section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "warning" | "success" | "info";
  /** Quando presente, o cartao inteiro vira um link pra tela que detalha esse numero. */
  href?: string;
}) {
  const accent = {
    neutral: "text-ink-900",
    warning: "text-amber-700",
    success: "text-emerald-700",
    info: "text-accent",
  }[tone];

  // Circulo decorativo bem sutil no canto -- so textura, nunca compete com o numero.
  const dot = {
    neutral: "bg-ink-200/50",
    warning: "bg-amber-200/40",
    success: "bg-emerald-200/40",
    info: "bg-accent/10",
  }[tone];

  const content = (
    <div className="relative overflow-hidden">
      <span className={cn("pointer-events-none absolute -top-5 -right-5 size-20 rounded-full", dot)} aria-hidden />
      <div className="relative">
        <p className="text-sm text-ink-500">{label}</p>
        <p className={cn("mt-2 text-3xl font-semibold tabular-nums tracking-tight", accent)}>
          {value}
        </p>
      </div>
      {hint ? (
        <p className="relative mt-3 border-t border-line pt-2.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus-ring card block p-5 transition hover:border-ink-300 hover:shadow-sm">
        {content}
      </Link>
    );
  }

  return <div className="card p-5">{content}</div>;
}
