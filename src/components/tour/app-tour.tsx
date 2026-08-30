"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  FileText,
  Grid3x3,
  HandHeart,
  Images,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { tourSteps, type TourStep } from "@/lib/tour";
import { cn } from "@/lib/utils";
import { completeTourAction } from "@/server/actions/tour";
import type { UserRole } from "@/types/database";

const ICONS: Record<TourStep["icon"], LucideIcon> = {
  wave: HandHeart,
  clients: Users,
  content: Images,
  approvals: CheckCircle2,
  documents: FileText,
  feed: Grid3x3,
  platform: Activity,
  settings: Settings,
  check: Sparkles,
};

/**
 * Tour de primeiro acesso. Cobre a tela inteira e trava a rolagem do fundo — a
 * pessoa termina ou pula, mas nao sai rolando por baixo do card.
 *
 * O "ja vi" e gravado no banco assim que o tour fecha, de qualquer maneira:
 * concluindo, pulando ou apertando Esc. Se a gravacao falhar, o tour some
 * mesmo assim nesta sessao — bloquear a entrada de alguem por causa de um
 * tutorial seria pior que mostra-lo de novo depois.
 */
export function AppTour({ role }: { role: UserRole }) {
  const steps = tourSteps(role);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void finish();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, steps.length]);

  async function finish() {
    setOpen(false);
    await completeTourAction();
  }

  if (!open) return null;

  const step = steps[index];
  if (!step) return null;

  const Icon = ICONS[step.icon];
  const isLast = index === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="card w-full max-w-md rounded-b-none p-6 shadow-xl sm:rounded-b-[14px]">
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-on-ink">
            <Icon className="size-5" aria-hidden />
          </span>

          <span className="text-xs text-ink-400 tabular-nums">
            {index + 1} de {steps.length}
          </span>
        </div>

        <h2 id="tour-title" className="mt-4 text-lg font-semibold text-ink-900">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>

        <div className="mt-5 flex items-center gap-1.5" aria-hidden>
          {steps.map((entry, position) => (
            <span
              key={entry.title}
              className={cn(
                "h-1 rounded-full transition-all",
                position === index ? "w-6 bg-ink-800" : "w-1.5 bg-ink-300",
              )}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void finish()}
            className="focus-ring rounded text-sm text-ink-500 transition hover:text-ink-900"
          >
            {isLast ? "Fechar" : "Pular tour"}
          </button>

          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="secondary" onClick={() => setIndex(index - 1)}>
                Voltar
              </Button>
            ) : null}

            {isLast ? (
              <Button onClick={() => void finish()}>Comecar a usar</Button>
            ) : (
              <Button onClick={() => setIndex(index + 1)}>Proximo</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
