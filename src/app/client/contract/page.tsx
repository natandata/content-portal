import type { Metadata } from "next";

import { ClientContract } from "@/features/client/contract";

export const metadata: Metadata = { title: "Contrato" };

export default function Page() {
  return <ClientContract />;
}
