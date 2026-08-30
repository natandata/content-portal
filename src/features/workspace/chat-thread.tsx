import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ChatThread as ChatThreadView } from "@/components/chat/chat-thread";
import { PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

/**
 * Conversa da equipe com um cliente especifico. A area da equipe fica sempre
 * em portugues (so o cliente escolhe idioma) — nao usar o cookie de locale
 * aqui, senao o composer troca de idioma sozinho se o navegador ja tiver
 * visitado a area do cliente em ingles.
 */
export async function StaffChatThread({ clientId }: { clientId: string }) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();
  const locale = DEFAULT_LOCALE;

  const [{ data: client }, { data: messages }, { data: contents }] = await Promise.all([
    supabase.from("clients").select("id, company_name").eq("id", clientId).maybeSingle(),
    supabase.rpc("chat_thread_messages", { p_client_id: clientId }),
    supabase
      .from("contents")
      .select("id, title")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false }),
  ]);

  if (!client) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href={`${base}/chat`}
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Chat
          </Link>
        }
        title={client.company_name}
        description="Mensagens visiveis para voce, o cliente e o administrador."
      />

      <ChatThreadView
        clientId={clientId}
        viewerId={actor.authUser.id}
        viewerRole={actor.role}
        locale={locale}
        messages={messages ?? []}
        allowLinkAttach
        contentOptions={(contents ?? []).map((content) => ({
          id: content.id,
          title: content.title,
        }))}
      />
    </>
  );
}
