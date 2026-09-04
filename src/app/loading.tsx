import { LoadingState } from "@/components/ui/feedback";
import { pickLocale } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";

// Fallback do Suspense de rota: primeira tela que qualquer navegacao mostra,
// inclusive a do cliente entrando pela primeira vez.
export default async function Loading() {
  const locale = await getLocale();

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LoadingState label={pickLocale(locale, "Carregando...", "Loading...")} />
    </div>
  );
}
