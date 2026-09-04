import type { Metadata } from "next";

import { ClientDashboard } from "@/features/client/dashboard";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.home };
}

export default function Page() {
  return <ClientDashboard />;
}
