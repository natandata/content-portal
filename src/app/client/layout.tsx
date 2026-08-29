import type { ReactNode } from "react";

import { ClientShell } from "@/components/shell/client-shell";
import { requireClientActor } from "@/lib/auth";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const actor = await requireClientActor();

  return (
    <ClientShell companyName={actor.client.company_name} accessCode={actor.client.access_code}>
      {children}
    </ClientShell>
  );
}
