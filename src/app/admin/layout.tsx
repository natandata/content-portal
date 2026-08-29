import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireAdmin();

  return (
    <WorkspaceShell
      role="admin"
      name={actor.displayName}
      email={actor.authUser.email ?? ""}
    >
      {children}
    </WorkspaceShell>
  );
}
