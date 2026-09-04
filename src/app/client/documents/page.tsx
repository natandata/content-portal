import type { Metadata } from "next";

import { ClientDocuments } from "@/features/client/documents";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.documents };
}

export default function Page() {
  return <ClientDocuments />;
}
