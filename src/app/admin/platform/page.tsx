import type { Metadata } from "next";

import { PlatformHealth } from "@/features/workspace/platform-health";

export const metadata: Metadata = { title: "Saude da plataforma" };

// Numeros de tamanho de banco e Storage mudam a cada visita.
export const dynamic = "force-dynamic";

export default function Page() {
  return <PlatformHealth />;
}
