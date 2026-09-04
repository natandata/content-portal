import type { Metadata } from "next";

import { ClientSettings } from "@/features/client/settings";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.settings };
}

export default function Page() {
  return <ClientSettings />;
}
