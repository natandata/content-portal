import type { Metadata } from "next";

import { ClientFeed } from "@/features/client/feed";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.feed };
}

export default function Page() {
  return <ClientFeed />;
}
