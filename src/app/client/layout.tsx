import type { ReactNode } from "react";

import { ClientShell } from "@/components/shell/client-shell";
import { OnboardingFlow } from "@/components/tour/onboarding-flow";
import { requireClientActor } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadClientBadges } from "@/server/queries";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const actor = await requireClientActor();

  const [badges, locale] = await Promise.all([
    loadClientBadges(await createClient()),
    getLocale(),
  ]);

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
