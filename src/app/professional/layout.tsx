import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { AppTour } from "@/components/tour/app-tour";
import { createClient } from "@/lib/supabase/server";
import { loadStaffBadges } from "@/server/queries";
import { HOME_BY_ROLE, requireStaff } from "@/lib/auth";

export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  const actor = await requireStaff();
  if (actor.role !== "professional") redirect(HOME_BY_ROLE[actor.role]);

  const badges = await loadStaffBadges(await createClient());

  return (
    <WorkspaceShell
      role="professional"
      name={actor.displayName}
      email={actor.authUser.email ?? ""}
      badges={badges}
    >
      {/* Primeiro acesso: o tour cobre a tela ate ser concluido ou pulado. */}
      {actor.profile?.tour_seen_at ? null : <AppTour role="professional" />}
      {children}
    </WorkspaceShell>
  );
}
