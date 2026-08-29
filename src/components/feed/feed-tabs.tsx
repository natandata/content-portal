"use client";

import { useState, type ReactNode } from "react";
import { Clapperboard, Grid3x3 } from "lucide-react";

import { cn } from "@/lib/utils";

type Tab = "posts" | "reels";

/**
 * Abas do perfil. A de reels e opcional porque nem todo cliente publica video —
 * quem decide e a equipe, no editor de perfil.
 */
export function FeedTabs({
  showReels,
  posts,
  reels,
}: {
  showReels: boolean;
  posts: ReactNode;
  reels: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("posts");
  const active = showReels ? tab : "posts";

  return (
    <div>
      <div className="flex border-y border-line">
        <button
          type="button"
          onClick={() => setTab("posts")}
          aria-label="Publicacoes"
          aria-current={active === "posts"}
          className={cn(
            "focus-ring flex flex-1 items-center justify-center border-b-2 py-2.5 transition",
            active === "posts"
              ? "border-ink-900 text-ink-900"
              : "border-transparent text-ink-400 hover:text-ink-600",
          )}
        >
          <Grid3x3 className="size-5" aria-hidden />
        </button>

        {showReels ? (
          <button
            type="button"
            onClick={() => setTab("reels")}
            aria-label="Reels"
            aria-current={active === "reels"}
            className={cn(
              "focus-ring flex flex-1 items-center justify-center border-b-2 py-2.5 transition",
              active === "reels"
                ? "border-ink-900 text-ink-900"
                : "border-transparent text-ink-400 hover:text-ink-600",
            )}
          >
            <Clapperboard className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="pt-0.5">{active === "posts" ? posts : reels}</div>
    </div>
  );
}
