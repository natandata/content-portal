"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { voteOnBulletinPostAction } from "@/server/actions/bulletin";

/** Curtir/nao curtir com toggle: clicar de novo no mesmo remove o voto. */
export function VoteButtons({
  postId,
  likes,
  dislikes,
  myVote,
  locale = DEFAULT_LOCALE,
}: {
  postId: string;
  likes: number;
  dislikes: number;
  myVote: 1 | -1 | null;
  locale?: Locale;
}) {
  const dict = getDictionary(locale).bulletin;
  const [state, setState] = useState({ likes, dislikes, myVote });
  const [busy, setBusy] = useState(false);

  async function cast(value: 1 | -1) {
    if (busy) return;
    const next = state.myVote === value ? 0 : value;

    // Otimista: a UI muda na hora, e desfaz se o servidor recusar.
    const previous = state;
    setState((current) => {
      let likesDelta = 0;
      let dislikesDelta = 0;
      if (current.myVote === 1) likesDelta -= 1;
      if (current.myVote === -1) dislikesDelta -= 1;
      if (next === 1) likesDelta += 1;
      if (next === -1) dislikesDelta += 1;
      return {
        likes: current.likes + likesDelta,
        dislikes: current.dislikes + dislikesDelta,
        myVote: next === 0 ? null : next,
      };
    });

    setBusy(true);
    const result = await voteOnBulletinPostAction(postId, next);
    setBusy(false);

    if (!result.ok) {
      setState(previous);
      toast.error(result.error);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void cast(1)}
        aria-pressed={state.myVote === 1}
        className={cn(
          "focus-ring flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
          state.myVote === 1
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
            : "border-line text-ink-500 hover:bg-ink-50",
        )}
      >
        <ThumbsUp className="size-3.5" aria-hidden />
        {dict.like}
        <span className="tabular-nums">{state.likes}</span>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => void cast(-1)}
        aria-pressed={state.myVote === -1}
        className={cn(
          "focus-ring flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
          state.myVote === -1
            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300"
            : "border-line text-ink-500 hover:bg-ink-50",
        )}
      >
        <ThumbsDown className="size-3.5" aria-hidden />
        {dict.dislike}
        <span className="tabular-nums">{state.dislikes}</span>
      </button>
    </div>
  );
}
