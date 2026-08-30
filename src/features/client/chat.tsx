import { PageHeader } from "@/components/ui/layout";
import { ChatThread } from "@/components/chat/chat-thread";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function ClientChat() {
  const actor = await requireClientActor();
  const supabase = await createClient();
  const { locale, dict } = await getServerDictionary();

  const { data: messages } = await supabase.rpc("chat_thread_messages", {
    p_client_id: actor.client.id,
  });

  return (
    <>
      <PageHeader title={dict.chat.title} description={dict.chat.subtitle} />

      <ChatThread
        clientId={actor.client.id}
        viewerId={actor.authUser.id}
        viewerRole="client"
        locale={locale}
        messages={messages ?? []}
        allowLinkAttach={false}
        contentOptions={[]}
      />
    </>
  );
}
