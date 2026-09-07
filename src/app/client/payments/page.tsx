import type { Metadata } from "next";

import { ClientDocumentsHub } from "@/features/client/documents-hub";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.payments };
}

/** Cobrancas agora mora dentro de Documentos, como aba — esta rota fica so
 * para notificacoes push de pagamento continuarem apontando pro lugar certo. */
export default function Page() {
  return <ClientDocumentsHub defaultTab="payments" />;
}
