import { Lightbulb } from "lucide-react";

import { IdeaCard } from "@/components/ideas/idea-card";
import { IdeaFormModal } from "@/components/ideas/idea-form-modal";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { BUCKETS } from "@/lib/paths";
import { signedUrlMap } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { IdeaImageRow } from "@/types/database";

export async function IdeasBoard() {
  const actor = await requireStaff();
  const supabase = await createClient();

  const { data: ideas } = await supabase
    .from("ideas")
    .select("*")
    .eq("professional_id", actor.authUser.id)
    .order("created_at", { ascending: false });

  const rows = ideas ?? [];
  const ideaIds = rows.map((idea) => idea.id);

  const { data: images } =
    ideaIds.length > 0
      ? await supabase.from("idea_images").select("*").in("idea_id", ideaIds).order("created_at")
      : { data: [] as IdeaImageRow[] };

  const imagesByIdea = new Map<string, IdeaImageRow[]>();
  for (const image of images ?? []) {
    const list = imagesByIdea.get(image.idea_id) ?? [];
    list.push(image);
    imagesByIdea.set(image.idea_id, list);
  }

  const imageUrls = await signedUrlMap(
    supabase,
    BUCKETS.ideas,
    (images ?? []).map((image) => image.file_path),
  );

  return (
    <>
      <PageHeader
        title="Banco de ideias"
        description="Anotacoes gerais com links de referencia e imagens de inspiracao."
        actions={<IdeaFormModal professionalId={actor.authUser.id} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="size-5" />}
          title="Nenhuma ideia ainda"
          description="Guarde referencias, links e imagens de inspiracao para o proximo conteudo."
          action={<IdeaFormModal professionalId={actor.authUser.id} />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              images={imagesByIdea.get(idea.id) ?? []}
              imageUrls={imageUrls}
              professionalId={actor.authUser.id}
            />
          ))}
        </div>
      )}
    </>
  );
}
