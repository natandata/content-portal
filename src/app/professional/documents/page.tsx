import type { Metadata } from "next";

import { DocumentsList } from "@/features/workspace/documents-list";

export const metadata: Metadata = { title: "Documentos" };

export default function Page() {
  return <DocumentsList />;
}
