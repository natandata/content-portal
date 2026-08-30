"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 5000;

/**
 * Cortina entre o login e a area interna. Dura 5s e a barra e real: mede o
 * tempo decorrido em vez de animar por CSS, entao o numero corresponde ao que
 * a pessoa ve.
 */
export function LoadingCurtain({
  onDone,
  message = "Estamos organizando seus conteudos",
}: {
  onDone: () => void;
  message?: string;
}) {
  const [progress, setProgress] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const start = Date.now();

    // setInterval e nao requestAnimationFrame: o rAF congela quando a aba vai
    // para segundo plano, e ai a cortina nunca terminaria.
    const id = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - start) / DURATION_MS);
      setProgress(ratio);
      if (ratio >= 1) {
        window.clearInterval(id);
        done.current();
      }
    }, 50);

    return () => window.clearInterval(id);
  }, []);

  const percent = Math.round(progress * 100);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-canvas px-6"
      role="status"
      aria-live="polite"
    >
      <span className="grid size-12 grid-cols-2 gap-[3px] rounded-xl bg-ink-900 p-2">
        <span className="rounded-[3px] bg-on-ink" />
        <span className="rounded-[3px] bg-on-ink/55" />
        <span className="rounded-[3px] bg-on-ink/55" />
        <span className="rounded-[3px] bg-on-ink" />
      </span>

      <p className="text-center text-base font-medium text-ink-900 sm:text-lg">{message}</p>

      <div className="w-full max-w-xs">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando"
        >
          <div
            className="h-full rounded-full bg-ink-900"
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="mt-2 text-center text-xs text-ink-500 tabular-nums">{percent}%</p>
      </div>
    </div>
  );
}
