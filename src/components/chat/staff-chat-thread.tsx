"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { markStaffChatReadAction, sendStaffChatMessageAction } from "@/server/actions/staff-chat";
import type { StaffChatThreadMessage } from "@/types/database";

function MessageBubble({ message, mine }: { message: StaffChatThreadMessage; mine: boolean }) {
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%]",
          mine ? "bg-ink-900 text-on-ink" : "bg-ink-100 text-ink-900",
        )}
      >
        {!mine ? (
          <p className="mb-0.5 text-xs font-semibold opacity-70">{message.sender_name}</p>
        ) : null}
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
      </div>
      <span className="mt-1 px-1 text-[11px] text-ink-400 tabular-nums">
        {formatDateTime(message.created_at)}
      </span>
    </div>
  );
}

/** Conversa admin <-> profissional. Um thread por profissional. */
export function StaffChatThread({
  professionalId,
  viewerId,
  messages,
}: {
  professionalId: string;
  viewerId: string;
  messages: StaffChatThreadMessage[];
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void markStaffChatReadAction(professionalId);
  }, [professionalId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const result = await sendStaffChatMessageAction({ professionalId, body: body.trim() });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setBody("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col rounded-xl border border-line bg-surface sm:h-[70dvh]">
      <div className="scroll-slim flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-ink-400">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} mine={message.sender_id === viewerId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="field-input min-h-[42px] flex-1 resize-none"
            rows={1}
            placeholder="Escreva uma mensagem..."
            value={body}
            disabled={busy}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />

          <Button size="md" loading={busy} disabled={!body.trim()} onClick={() => void send()}>
            <Send className="size-4" aria-hidden />
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
