import { cn } from "@/lib/utils";

/**
 * Contador ao lado do nome do item de menu. Acima de 99 vira "99+" para nao
 * esticar a linha.
 */
export function NavBadge({
  count,
  tone = "default",
  className,
}: {
  count: number;
  tone?: "default" | "onDark";
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        tone === "onDark" ? "bg-on-ink/20 text-on-ink" : "bg-accent text-white",
        className,
      )}
      aria-label={`${count} atualizacao(oes)`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
