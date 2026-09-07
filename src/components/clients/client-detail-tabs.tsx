"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Abas simples: todo o conteudo ja vem renderizado do servidor, so trocamos
 * qual bloco fica visivel. Evita nova busca de dados ao trocar de aba.
 */
export function ClientDetailTabs({
  tabs,
  defaultTab,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
  /** Qual aba comeca ativa — usado quando a pagina e um destino direto para
   * uma aba especifica (link salvo, notificacao push) em vez da primeira. */
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-line overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              "focus-ring shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active === tab.id
                ? "border-accent text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div key={tab.id} hidden={active !== tab.id}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
