import type { ReactNode } from "react";

import { ClientShell } from "@/components/shell/client-shell";
import { OnboardingFlow } from "@/components/tour/onboarding-flow";
import { requireClientActor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadClientBadges } from "@/server/queries";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const actor = await requireClientActor();

  const badges = await loadClientBadges(await createClient());

  return (
    <ClientShell
      companyName={actor.client.company_name}
      accessCode={actor.client.access_code}
      badges={badges}
    >
      <OnboardingFlow
        role="client"
        showTour={!actor.client.tour_seen_at}
        showNotificationPrompt={!actor.client.notifications_prompted_at}
      />
      {children}
    </ClientShell>
  );
}
