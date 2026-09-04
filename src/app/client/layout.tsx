import type { ReactNode } from "react";

import { ClientShell } from "@/components/shell/client-shell";
import { OnboardingFlow } from "@/components/tour/onboarding-flow";
import { requireClientActor } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadClientBadges } from "@/server/queries";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const actor = await requireClientActor();

  const supabase = await createClient();
  const [badges, locale] = await Promise.all([loadClientBadges(supabase), getLocale()]);

  // Sincroniza o cookie (a fonte da verdade de tela) para a conta, silenciosamente
  // -- e o unico jeito de uma notificacao push, composta depois sem navegador
  // nenhum por perto, saber em que idioma o cliente prefere ler.
  if (actor.client.preferred_locale !== locale) {
    void supabase.rpc("set_preferred_locale", { p_locale: locale }).then(({ error }) => {
      if (error) console.error("[client-layout] set_preferred_locale falhou:", error);
    });
  }

  return (
    <ClientShell
      companyName={actor.client.company_name}
      accessCode={actor.client.access_code}
      badges={badges}
      locale={locale}
    >
      {/* So `locale` cruza para os Client Components abaixo — nunca o dicionario
          inteiro, que tem campos com funcao e o RSC nao serializa. */}
      <OnboardingFlow
        role="client"
        locale={locale}
        showTour={!actor.client.tour_seen_at}
        showNotificationPrompt={!actor.client.notifications_prompted_at}
      />
      {children}
    </ClientShell>
  );
}
