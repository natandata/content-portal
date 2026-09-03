import type { Metadata } from "next";

export const metadata: Metadata = { title: "Calendário" };

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Calendário</h1>
        <p className="mt-2 text-ink-600">
          Posts organizados por dia do mês com opções de visão: Mês, Semana e Dia, incluindo
          horários dos posts.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="text-ink-600">
          Funcionalidade em desenvolvimento. Em breve você poderá visualizar e gerenciar seus
          posts no calendário.
        </p>
      </div>
    </div>
  );
}
