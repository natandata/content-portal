"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Link2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { resolveChatLinkHref } from "@/lib/chat";
import { cn, formatDateTime } from "@/lib/utils";
import { markChatReadAction, sendChatMessageAction } from "@/server/actions/chat";
import type { ChatLinkTarget, ChatThreadMessage, UserRole } from "@/types/database";

export interface ContentOption {
  id: string;
  title: string;
}

const LINK_ICON: Record<ChatLinkTarget, typeof Link2> = {
  dashboard: Link2,
  content: Link2,
  documents: Link2,
  feed: Link2,
};

function LinkCard({
  message,
  viewerRole,
  locale,
}: {
  message: ChatThreadMessage;
  viewerRole: UserRole;
  locale: Locale;
}) {
  const dict = getDictionary(locale).chat;
  if (!message.link_target_type) return null;

  const href = resolveChatLinkHref(viewerRole, message.link_target_type, message.link_target_id);
  const Icon = LINK_ICON[message.link_target_type];

  return (
    <Link
      href={href}
      className="focus-ring mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent-soft"
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{message.link_label || dict.openLink}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
    </Link>
  );
}

function MessageBubble({
  message,
  mine,
  viewerRole,
  locale,
}: {
  message: ChatThreadMessage;
  mine: boolean;
  viewerRole: UserRole;
  locale: Locale;
}) {
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
        {message.body ? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        ) : null}
        {message.link_target_type ? (
          <LinkCard message={message} viewerRole={viewerRole} locale={locale} />
        ) : null}
      </div>
      <span className="mt-1 px-1 text-[11px] text-ink-400 tabular-nums">
        {formatDateTime(message.created_at, locale === "en" ? "en-US" : "pt-BR")}
      </span>
    </div>
  );
}

function LinkAttachPanel({
  locale,
  contentOptions,
  onAttach,
  onCancel,
}: {
  locale: Locale;
  contentOptions: ContentOption[];
  onAttach: (target: { type: ChatLinkTarget; id: string | null; label: string }) => void;
  onCancel: () => void;
}) {
  const dict = getDictionary(locale).chat;
  const [type, setType] = useState<ChatLinkTarget>("dashboard");
  const [contentId, setContentId] = useState(contentOptions[0]?.id ?? "");
  const [label, setLabel] = useState("");

  const TYPE_LABEL: Record<ChatLinkTarget, string> = {
    dashboard: dict.linkTargetDashboard,
    content: dict.linkTargetContent,
    documents: dict.linkTargetDocuments,
    feed: dict.linkTargetFeed,
  };

  return (
    <div className="mb-2 rounded-xl border border-line bg-ink-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-700">{dict.linkTarget}</p>
        <IconButton label={dict.cancel} className="size-6" onClick={onCancel}>
          <X className="size-3.5" />
        </IconButton>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Select value={type} onChange={(event) => setType(event.target.value as ChatLinkTarget)}>
          {(Object.keys(TYPE_LABEL) as ChatLinkTarget[]).map((option) => (
            <option key={option} value={option}>
              {TYPE_LABEL[option]}
            </option>
          ))}
        </Select>

        {type === "content" ? (
          <Select value={contentId} onChange={(event) => setContentId(event.target.value)}>
            {contentOptions.length === 0 ? (
              <option value="">{dict.linkTargetContentPlaceholder}</option>
            ) : (
              contentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))
            )}
          </Select>
        ) : (
          <input
            className="field-input"
            placeholder={dict.linkLabelPlaceholder}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        )}
      </div>

      {type === "content" ? (
        <input
          className="field-input mt-2"
          placeholder={dict.linkLabelPlaceholder}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      ) : null}

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={type === "content" && !contentId}
          onClick={() =>
            onAttach({
              type,
              id: type === "content" ? contentId : null,
              label: label.trim() || TYPE_LABEL[type],
            })
          }
        >
          <Paperclip className="size-3.5" aria-hidden />
          {dict.attachLink}
        </Button>
      </div>
    </div>
  );
}

export function ChatThread({
  clientId,
  viewerId,
  viewerRole,
  locale,
  messages,
  allowLinkAttach,
  contentOptions,
}: {
  clientId: string;
  viewerId: string;
  viewerRole: UserRole;
  locale: Locale;
  messages: ChatThreadMessage[];
  allowLinkAttach: boolean;
  contentOptions: ContentOption[];
}) {
  const dict = getDictionary(locale).chat;
  const [body, setBody] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [pendingLink, setPendingLink] = useState<{
    type: ChatLinkTarget;
    id: string | null;
    label: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void markChatReadAction(clientId);
  }, [clientId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    if (!body.trim() && !pendingLink) return;
    setBusy(true);
    try {
      const result = await sendChatMessageAction({
        clientId,
        body: body.trim() || undefined,
        linkTargetType: pendingLink?.type,
        linkTargetId: pendingLink?.id ?? undefined,
        linkLabel: pendingLink?.label,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setBody("");
      setPendingLink(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col rounded-xl border border-line bg-surface sm:h-[70dvh]">
      <div className="scroll-slim flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-ink-400">{dict.threadEmpty}</p>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.sender_id === viewerId}
              viewerRole={viewerRole}
              locale={locale}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-3">
        {pendingLink ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent">
            <Link2 className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{pendingLink.label}</span>
            <IconButton
              label={dict.cancel}
              className="size-6"
              onClick={() => setPendingLink(null)}
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
        ) : null}

        {attaching ? (
          <LinkAttachPanel
            locale={locale}
            contentOptions={contentOptions}
            onCancel={() => setAttaching(false)}
            onAttach={(target) => {
              setPendingLink(target);
              setAttaching(false);
            }}
          />
        ) : null}

        <div className="flex items-end gap-2">
          {allowLinkAttach ? (
            <IconButton
              label={dict.attachLink}
              className={cn(attaching && "bg-ink-100")}
              onClick={() => setAttaching((v) => !v)}
              disabled={busy}
            >
              <Paperclip className="size-4" />
            </IconButton>
          ) : null}

          <textarea
            className="field-input min-h-[42px] flex-1 resize-none"
            rows={1}
            placeholder={dict.placeholder}
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

          <Button
            size="md"
            loading={busy}
            disabled={!body.trim() && !pendingLink}
            onClick={() => void send()}
          >
            <Send className="size-4" aria-hidden />
            {dict.send}
          </Button>
        </div>
      </div>
    </div>
  );
}
