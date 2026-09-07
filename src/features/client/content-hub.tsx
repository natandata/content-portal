import { ClientDetailTabs } from "@/components/clients/client-detail-tabs";
import { ClientCalendar } from "@/features/client/calendar";
import { ClientContents } from "@/features/client/contents";
import { ClientFeed } from "@/features/client/feed";
import { getServerDictionary } from "@/lib/i18n/server";

export type ContentHubTab = "content" | "feed" | "calendar";

/**
 * Conteudos, Feed e Calendario viviam em 3 itens separados no menu do
 * cliente — reduzido a um so, com abas, porque os tres giram em torno da
 * mesma coisa (o conteudo produzido) vista de jeitos diferentes.
 *
 * As rotas antigas (`/client/feed`, `/client/calendar`) continuam existindo
 * e caem aqui com a aba certa ja selecionada — links salvos e notificacoes
 * push que apontam para elas continuam funcionando.
 */
export async function ClientContentHub({ defaultTab = "content" }: { defaultTab?: ContentHubTab }) {
  const { dict } = await getServerDictionary();

  return (
    <ClientDetailTabs
      defaultTab={defaultTab}
      tabs={[
        { id: "content", label: dict.nav.content, content: <ClientContents /> },
        { id: "feed", label: dict.nav.feed, content: <ClientFeed /> },
        { id: "calendar", label: dict.nav.calendar, content: <ClientCalendar /> },
      ]}
    />
  );
}
