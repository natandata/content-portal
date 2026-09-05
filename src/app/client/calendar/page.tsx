import type { Metadata } from "next";

import { ClientCalendar } from "@/features/client/calendar";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.calendar };
}

export default function Page() {
  return <ClientCalendar />;
}
