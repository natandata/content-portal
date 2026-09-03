import type { Metadata } from "next";

export const metadata: Metadata = { title: "Relatórios" };

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Relatórios</h1>
        <p className="mt-2 text-ink-600">
          Local em que você pode cadastrar e puxar métricas do cliente. No futuro, será possível
          integrar para puxar todas as métricas de dentro da conta do cliente automaticamente.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="text-ink-600">
          Funcionalidade em desenvolvimento. Em breve você poderá visualizar relatórios e
          métricas de seus clientes.
        </p>
      </div>
    </div>
  );
}
