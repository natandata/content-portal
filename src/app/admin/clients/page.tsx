import type { Metadata } from "next";

import { ClientsList } from "@/features/workspace/clients-list";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return <ClientsList />;
}
