import type { Metadata } from "next";

import { ClientDocumentsHub } from "@/features/client/documents-hub";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.documents };
}

export default function Page() {
  return <ClientDocumentsHub defaultTab="documents" />;
}
