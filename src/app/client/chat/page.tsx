import type { Metadata } from "next";

import { ClientChat } from "@/features/client/chat";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.chat };
}

export default function Page() {
  return <ClientChat />;
}
