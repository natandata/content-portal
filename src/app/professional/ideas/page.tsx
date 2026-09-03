import type { Metadata } from "next";

export const metadata: Metadata = { title: "Banco de Ideias" };

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Banco de Ideias</h1>
        <p className="mt-2 text-ink-600">
          Banco de anotações gerais com possibilidades de inserir links (referência de conteúdo)
          e imagens.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="text-ink-600">
          Funcionalidade em desenvolvimento. Em breve você poderá armazenar e organizar suas
          ideias de conteúdo.
        </p>
      </div>
    </div>
  );
}
