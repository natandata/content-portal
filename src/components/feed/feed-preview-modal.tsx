"use client";

import { useState } from "react";
import { Grid3x3 } from "lucide-react";

import { FeedGrid, type FeedEntry } from "@/components/feed/feed-grid";
import { InstagramHeader, type ProfileView } from "@/components/feed/instagram-profile";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MAX_FEED_ITEMS } from "@/lib/domain";

/**
 * "Ver no feed": mostra o perfil como ficaria se este conteudo fosse publicado
 * agora — ou seja, ocupando a primeira posicao da grade, que e onde o post mais
 * recente aparece no Instagram. Nao altera o feed de verdade.
 */
export function FeedPreviewModal({
  entries,
  candidate,
  profile,
  fallbackName,
  alreadyInFeed,
}: {
  entries: FeedEntry[];
  candidate: FeedEntry;
  profile: ProfileView;
  fallbackName: string;
  alreadyInFeed: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Ja estando no feed, mostramos a composicao como ela e hoje.
  const composition = alreadyInFeed
    ? entries
    : [candidate, ...entries].slice(0, MAX_FEED_ITEMS);

  const postCount = profile.postsCountIsAuto ? composition.length : profile.postsCount;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Grid3x3 className="size-4" aria-hidden />
        Ver no feed
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ver no feed"
        description={
          alreadyInFeed
            ? "Este conteudo ja esta na composicao do feed."
            : "Previa de como o perfil ficaria com este post publicado agora."
        }
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        }
      >
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <InstagramHeader
            profile={{ ...profile, postsCount: postCount }}
            fallbackName={fallbackName}
          />

          <div className="border-t border-line p-1.5">
            <FeedGrid
              entries={composition}
              fill={false}
              emptyLabel="Nada no feed ainda."
              highlightId={alreadyInFeed ? undefined : candidate.contentId}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
