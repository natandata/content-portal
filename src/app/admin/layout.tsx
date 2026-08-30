import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { OnboardingFlow } from "@/components/tour/onboarding-flow";
import { createClient } from "@/lib/supabase/server";
import { loadStaffBadges } from "@/server/queries";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireAdmin();

  const badges = await loadStaffBadges(await createClient());

  return (
    <WorkspaceShell
      role="admin"
      name={actor.displayName}
      email={actor.authUser.email ?? ""}
      badges={badges}
    >
      {/* Primeiro acesso: tour e depois o convite de notificacoes. */}
      <OnboardingFlow
        role="admin"
        showTour={!actor.profile?.tour_seen_at}
        showNotificationPrompt={!actor.profile?.notifications_prompted_at}
      />
      {children}
    </WorkspaceShell>
  );
}
