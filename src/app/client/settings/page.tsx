import type { Metadata } from "next";

import { ClientSettings } from "@/features/client/settings";

export const metadata: Metadata = { title: "Configuracoes" };

export default function Page() {
  return <ClientSettings />;
}
