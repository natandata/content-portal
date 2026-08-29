import { Grid3x3 } from "lucide-react";

import { FeedEditor, type AvailableContent } from "@/components/feed/feed-editor";
import type { FeedEntry } from "@/components/feed/feed-grid";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadContentPreviews } from "@/server/queries";

import { ClientSwitcher } from "./client-switcher";

export async function FeedBoard({ clientId }: { clientId?: string }) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name")
    .order("company_name");

  const options = (clients ?? []).map((client) => ({
    id: client.id,
    companyName: client.company_name,
  }));

  const selectedId = clientId ?? options[0]?.id;

  if (!selectedId) {
    return (
      <>
        <PageHeader title="Feed" description="Simulacao do feed do Instagram, 3 x 10." />
        <EmptyState
          icon={<Grid3x3 className="size-5" />}
          title="Nenhum cliente cadastrado"
          description="Crie um cliente para montar a simulacao do feed."
        />
      </>
    );
  }

  const [{ data: feedItems }, { data: contents }] = await Promise.all([
    supabase
      .from("feed_items")
      .select("id, content_id, position")
      .eq("client_id", selectedId)
      .order("position"),
    supabase
      .from("contents")
      .select("id, title, type")
      .eq("client_id", selectedId)
      .order("updated_at", { ascending: false }),
  ]);

  const contentById = new Map((contents ?? []).map((content) => [content.id, content]));
  const previews = await loadContentPreviews(
    supabase,
    (contents ?? []).map((content) => content.id),
  );

  const entries: FeedEntry[] = (feedItems ?? []).flatMap((item) => {
    const content = contentById.get(item.content_id);
    if (!content) return [];
    return [
      {
        feedItemId: item.id,
        contentId: item.content_id,
        title: content.title,
        type: content.type,
        previewUrl: previews.get(item.content_id) ?? null,
        position: item.position,
      },
    ];
  });

  const usedIds = new Set(entries.map((entry) => entry.contentId));
  const available: AvailableContent[] = (contents ?? [])
    .filter((content) => !usedIds.has(content.id))
    .map((content) => ({
      id: content.id,
      title: content.title,
      type: content.type,
      previewUrl: previews.get(content.id) ?? null,
    }));

  const selectedClient = options.find((option) => option.id === selectedId);

  return (
    <>
      <PageHeader
        title="Feed"
        description={`Simulacao do feed de ${selectedClient?.companyName ?? "cliente"} — 3 colunas x 10 linhas.`}
      />

      <div className="mb-6">
        <ClientSwitcher
          basePath={`${base}/feed`}
          clients={options}
          selectedClientId={selectedId}
        />
      </div>

      <FeedEditor clientId={selectedId} initialEntries={entries} available={available} />
    </>
  );
}
