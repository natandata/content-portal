import type { Metadata } from "next";

import { ClientContents } from "@/features/client/contents";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.content };
}

export default function Page() {
  return <ClientContents />;
}
