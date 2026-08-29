import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <p className="text-sm font-medium text-ink-400">404</p>
      <h1 className="mt-2 text-xl font-semibold text-ink-900">Pagina nao encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        O endereco nao existe ou o registro foi removido.
      </p>
      <LinkButton href="/" className="mt-6">
        Voltar ao inicio
      </LinkButton>
    </main>
  );
}
