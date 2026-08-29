import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { HOME_BY_ROLE, requireStaff } from "@/lib/auth";

export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  const actor = await requireStaff();
  if (actor.role !== "professional") redirect(HOME_BY_ROLE[actor.role]);

  return (
    <WorkspaceShell
      role="professional"
      name={actor.displayName}
      email={actor.authUser.email ?? ""}
    >
      {children}
    </WorkspaceShell>
  );
}
