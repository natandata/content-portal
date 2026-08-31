import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { StaffChatThread } from "@/components/chat/staff-chat-thread";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Conversa entre o admin e um profissional especifico. O admin chega aqui a
 * partir da lista de profissionais no Chat; o profissional so tem o proprio
 * thread, entao chega direto (sem lista).
 */
export async function StaffChatThreadPage({ professionalId }: { professionalId: string }) {
  const actor = await requireStaff();
  const supabase = await createClient();

  if (actor.role !== "admin" && actor.authUser.id !== professionalId) {
    notFound();
  }

  const [{ data: professional }, { data: messages }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name")
      .eq("id", professionalId)
      .eq("role", "professional")
      .maybeSingle(),
    supabase.rpc("staff_chat_thread_messages", { p_professional_id: professionalId }),
  ]);

  if (!professional) notFound();

  const backHref = actor.role === "admin" ? "/admin/chat" : "/professional/chat";
  const title = actor.role === "admin" ? professional.name : "Chat com o administrador";

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href={backHref}
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Chat
          </Link>
        }
        title={title}
        description="Mensagens visiveis apenas para voces dois."
      />

      <StaffChatThread
        professionalId={professionalId}
        viewerId={actor.authUser.id}
        messages={messages ?? []}
      />
    </>
  );
}
