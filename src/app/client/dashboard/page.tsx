import type { Metadata } from "next";

import { ClientDashboard } from "@/features/client/dashboard";

export const metadata: Metadata = { title: "Inicio" };

export default function Page() {
  return <ClientDashboard />;
}
