import type { Metadata } from "next";

import { ClientDocuments } from "@/features/client/documents";

export const metadata: Metadata = { title: "Documentos" };

export default function Page() {
  return <ClientDocuments />;
}
