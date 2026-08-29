import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
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
      {children}
    </WorkspaceShell>
  );
}
