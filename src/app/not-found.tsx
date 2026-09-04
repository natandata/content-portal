import { LinkButton } from "@/components/ui/button";
import { pickLocale } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";

export default async function NotFound() {
  const locale = await getLocale();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <p className="text-sm font-medium text-ink-400">404</p>
      <h1 className="mt-2 text-xl font-semibold text-ink-900">
        {pickLocale(locale, "Pagina nao encontrada", "Page not found")}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        {pickLocale(locale, "O endereco nao existe ou o registro foi removido.", "This address does not exist or the record was removed.")}
      </p>
      <LinkButton href="/" className="mt-6">
        {pickLocale(locale, "Voltar ao inicio", "Back to home")}
      </LinkButton>
    </main>
  );
}
