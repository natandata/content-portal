import type { Metadata } from "next";

import { ClientContentHub } from "@/features/client/content-hub";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.feed };
}

/** Feed agora mora dentro de Conteudos, como aba — esta rota fica so para
 * links salvos e notificacoes push antigas continuarem funcionando. */
export default function Page() {
  return <ClientContentHub defaultTab="feed" />;
}
