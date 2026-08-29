"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Grid3x3, Minus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addFeedItemAction, removeFeedItemAction } from "@/server/actions/feed";

/** Coloca ou tira o conteudo da simulacao de feed do cliente. */
export function FeedQuickAdd({
  clientId,
  contentId,
  feedItemId,
  position,
}: {
  clientId: string;
  contentId: string;
  feedItemId: string | null;
  position: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (feedItemId) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-600">
          No feed na posicao <strong className="text-ink-900">{position}</strong>.
        </p>
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await removeFeedItemAction(clientId, feedItemId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Removido do feed.");
              router.refresh();
            })
          }
        >
          <Minus className="size-4" aria-hidden />
          Remover do feed
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await addFeedItemAction(clientId, contentId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Adicionado ao feed.");
          router.refresh();
        })
      }
    >
      <Grid3x3 className="size-4" aria-hidden />
      Adicionar ao feed
    </Button>
  );
}
