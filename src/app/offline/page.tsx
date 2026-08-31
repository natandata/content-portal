import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Sem conexao" };

// Precisa ser estatica: o service worker guarda esta pagina no install e a
// serve quando a rede cai, entao ela nao pode depender de sessao nem de banco.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        <WifiOff className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-ink-900">Voce esta sem conexao</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        O Content precisa de internet para carregar contratos, conteudos e aprovacoes.
        Assim que a conexao voltar, atualize a pagina.
      </p>
    </main>
  );
}
