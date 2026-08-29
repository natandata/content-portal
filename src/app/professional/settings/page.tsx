import type { Metadata } from "next";

import { WorkspaceSettings } from "@/features/workspace/settings";

export const metadata: Metadata = { title: "Configuracoes" };

export default function Page() {
  return <WorkspaceSettings />;
}
