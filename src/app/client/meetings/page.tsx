import type { Metadata } from "next";

import { ClientMeetings } from "@/features/client/meetings";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.meetings };
}

export default function Page() {
  return <ClientMeetings />;
}
