import type { Metadata } from "next";

import { ContractsList } from "@/features/workspace/contracts-list";

export const metadata: Metadata = { title: "Contratos" };

export default function Page() {
  return <ContractsList />;
}
