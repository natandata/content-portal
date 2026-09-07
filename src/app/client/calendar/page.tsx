import type { Metadata } from "next";

import { ClientContentHub } from "@/features/client/content-hub";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.calendar };
}

/** Calendario agora mora dentro de Conteudos, como aba — esta rota fica so
 * para links salvos continuarem funcionando. */
export default function Page() {
  return <ClientContentHub defaultTab="calendar" />;
}
