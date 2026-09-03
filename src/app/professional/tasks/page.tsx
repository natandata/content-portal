import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tarefas" };

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Tarefas</h1>
        <p className="mt-2 text-ink-600">
          Sistema de Gestão de Tarefas com criação, alteração, descrição e exclusão de tarefas.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="text-ink-600">
          Funcionalidade em desenvolvimento. Em breve você poderá gerenciar suas tarefas aqui.
        </p>
      </div>
    </div>
  );
}
