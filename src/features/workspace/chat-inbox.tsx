import Link from "next/link";
import { MessageCircle, ShieldCheck } from "lucide-react";

import { NavBadge } from "@/components/shell/nav-badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card, PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeDay, initials } from "@/lib/utils";

/** Lista de conversas — um item por cliente que a equipe gerencia, mais o admin. */
export async function ChatInbox() {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const { data: inbox } = await supabase.rpc("chat_inbox");
  const { data: adminUnread } = await supabase.rpc("unread_staff_chat_count");
  const rows = inbox ?? [];

  return (
    <>
      <PageHeader title="Chat" description="Converse com cada cliente que voce atende." />

      <Card padded={false} className="mb-4">
        <Link
          href={`${base}/chat/admin`}
          className="focus-ring flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50 sm:px-5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldCheck className="size-5" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">Administrador</p>
            <p className="truncate text-xs text-ink-500">Fale direto com quem administra a conta</p>
          </div>

          {(adminUnread ?? 0) > 0 ? <NavBadge count={adminUnread ?? 0} className="ml-0" /> : null}
        </Link>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-5" />}
          title="Nenhum cliente cadastrado"
          description="Assim que voce cadastrar um cliente, a conversa aparece aqui."
        />
      ) : (
        <Card padded={false} className="divide-y divide-line">
          {rows.map((entry) => (
            <Link
              key={entry.client_id}
              href={`${base}/chat/${entry.client_id}`}
              className="focus-ring flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50 sm:px-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                {initials(entry.company_name)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{entry.company_name}</p>
                <p className="truncate text-xs text-ink-500">
                  {entry.last_message || "Nenhuma mensagem ainda"}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {entry.last_message_at ? (
                  <span className="text-[11px] text-ink-400">
                    {formatRelativeDay(entry.last_message_at)}
                  </span>
                ) : null}
                {entry.unread_count > 0 ? <NavBadge count={entry.unread_count} className="ml-0" /> : null}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
