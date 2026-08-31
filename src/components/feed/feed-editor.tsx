"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Grid3x3, Layers, Play, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { MAX_FEED_ITEMS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { addFeedItemAction, removeFeedItemAction, reorderFeedAction } from "@/server/actions/feed";
import type { ContentType } from "@/types/database";

import { FeedGrid, type FeedEntry } from "./feed-grid";
import { FeedTabs } from "./feed-tabs";
import { InstagramHeader, type ProfileView } from "./instagram-profile";
import { QuickFeedUpload } from "./quick-feed-upload";

export interface AvailableContent {
  id: string;
  title: string;
  type: ContentType;
  previewUrl: string | null;
}

function TypeMark({ type }: { type: ContentType }) {
  if (type === "image") return null;
  return (
    <span className="absolute top-1.5 right-1.5 text-white drop-shadow">
      {type === "video" ? (
        <Play className="size-4 fill-current" aria-hidden />
      ) : (
        <Layers className="size-4" aria-hidden />
      )}
    </span>
  );
}

function SortableCell({
  entry,
  index,
  onRemove,
  disabled,
}: {
  entry: FeedEntry;
  index: number;
  onRemove: (entry: FeedEntry) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.feedItemId,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative aspect-square touch-none overflow-hidden bg-ink-100",
        isDragging ? "z-10 opacity-70 ring-2 ring-accent" : "cursor-grab active:cursor-grabbing",
      )}
      {...attributes}
      {...listeners}
    >
      {entry.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.previewUrl}
          alt={entry.title}
          loading="lazy"
          draggable={false}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-ink-300">
          <Grid3x3 className="size-5" aria-hidden />
        </div>
      )}

      <TypeMark type={entry.type} />

      <span className="absolute bottom-1 left-1 rounded bg-ink-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
        {index + 1}
      </span>

      <button
        type="button"
        aria-label={`Remover ${entry.title} do feed`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(entry);
        }}
        className="focus-ring absolute top-1 left-1 flex size-6 items-center justify-center rounded-full bg-ink-900/70 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 sm:opacity-0"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Simulacao do feed do Instagram: 3 colunas x 10 linhas, com drag and drop. */
export function FeedEditor({
  clientId,
  initialEntries,
  available,
  profile,
  fallbackName,
  profileEditor,
}: {
  clientId: string;
  initialEntries: FeedEntry[];
  available: AvailableContent[];
  profile: ProfileView;
  fallbackName: string;
  profileEditor: ReactNode;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [savedOrder, setSavedOrder] = useState(initialEntries);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setEntries(initialEntries);
    setSavedOrder(initialEntries);
  }, [initialEntries]);

  const dirty = useMemo(
    () =>
      entries.length !== savedOrder.length ||
      entries.some((entry, index) => entry.feedItemId !== savedOrder[index]?.feedItemId),
    [entries, savedOrder],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => entries.map((entry) => entry.feedItemId), [entries]);
  const emptySlots = Math.max(0, MAX_FEED_ITEMS - entries.length);
  const full = entries.length >= MAX_FEED_ITEMS;
  const reels = useMemo(() => entries.filter((entry) => entry.type === "video"), [entries]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = entries.findIndex((entry) => entry.feedItemId === active.id);
    const to = entries.findIndex((entry) => entry.feedItemId === over.id);
    if (from < 0 || to < 0) return;

    // So reorganiza local — persiste tudo de uma vez quando clicar em Salvar.
    setEntries(arrayMove(entries, from, to));
  }

  async function saveOrder() {
    setSaving(true);
    try {
      const result = await reorderFeedAction(
        clientId,
        entries.map((entry) => entry.contentId),
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setSavedOrder(entries);
      toast.success("Feed salvo — ja atualizado para o cliente.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function remove(entry: FeedEntry) {
    if (dirty) {
      toast.error("Salve a nova ordem antes de remover um item.");
      return;
    }

    const previous = entries;
    setEntries(entries.filter((item) => item.feedItemId !== entry.feedItemId));

    startTransition(async () => {
      const result = await removeFeedItemAction(clientId, entry.feedItemId);
      if (!result.ok) {
        setEntries(previous);
        toast.error(result.error);
        return;
      }
      toast.success("Removido do feed.");
      router.refresh();
    });
  }

  function add(contentId: string) {
    startTransition(async () => {
      const result = await addFeedItemAction(clientId, contentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Adicionado ao feed.");
      setPickerOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-500 tabular-nums">
            {entries.length} de {MAX_FEED_ITEMS} posicoes
            {dirty ? <span className="ml-2 text-amber-600">· alteracoes nao salvas</span> : null}
          </p>
          <div className="flex gap-2">
            {profileEditor}
            <Button
              size="sm"
              variant="outline"
              disabled={full || pending}
              onClick={() => setUploadOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Enviar foto
            </Button>
            <Button size="sm" disabled={full || pending} onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Adicionar
            </Button>
            <Button size="sm" loading={saving} disabled={!dirty || pending} onClick={() => void saveOrder()}>
              <Save className="size-4" aria-hidden />
              Salvar
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {/* Mesma moldura que o cliente enxerga — o que muda e poder arrastar. */}
          <InstagramHeader
            profile={{ ...profile, postsCount: profile.postsCountIsAuto ? entries.length : profile.postsCount }}
            fallbackName={fallbackName}
          />

          <FeedTabs
            showReels={profile.showReelsTab}
            posts={
              <div className="p-1.5">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext items={ids} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-3 gap-1">
                      {entries.map((entry, index) => (
                        <SortableCell
                          key={entry.feedItemId}
                          entry={entry}
                          index={index}
                          onRemove={remove}
                          disabled={pending || saving}
                        />
                      ))}

                      {Array.from({ length: emptySlots }).map((_, index) => (
                        <button
                          key={`empty-${index}`}
                          type="button"
                          onClick={() => setUploadOpen(true)}
                          disabled={pending || saving}
                          aria-label="Adicionar foto nesta posicao"
                          className="focus-ring group flex aspect-square flex-col items-center justify-center gap-1 border border-dashed border-line bg-ink-50/60 text-ink-300 transition hover:border-ink-300 hover:bg-ink-100 hover:text-ink-500 disabled:opacity-50"
                        >
                          <Plus className="size-4 opacity-0 transition group-hover:opacity-100" aria-hidden />
                          <span className="text-[11px] tabular-nums">{entries.length + index + 1}</span>
                        </button>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            }
            reels={
              <div className="p-1.5">
                <FeedGrid
                  entries={reels}
                  fill={false}
                  emptyLabel="Nenhum conteudo de video no feed."
                />
              </div>
            }
          />
        </div>

        <p className="mt-3 text-xs text-ink-500">
          Arraste as miniaturas para reorganizar. A ordem e salva automaticamente.
        </p>
      </div>

      <div className="hidden lg:block">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink-900">Como funciona</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            <li>A grade reproduz o feed do Instagram: 3 colunas por 10 linhas.</li>
            <li>Videos usam a miniatura do primeiro frame; carrosseis usam o slide 1.</li>
            <li>O cliente ve a mesma composicao, sem poder reorganizar.</li>
            <li>Foto, nome, @, bio e destaques saem de &ldquo;Editar perfil&rdquo;.</li>
            <li>A aba de reels lista os videos que estao no feed.</li>
          </ul>
        </div>
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Adicionar ao feed"
        description="Escolha um conteudo ja cadastrado para este cliente."
        size="lg"
      >
        {available.length === 0 ? (
          <EmptyState
            title="Nenhum conteudo disponivel"
            description="Todos os conteudos deste cliente ja estao no feed."
          />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {available.map((content) => (
              <button
                key={content.id}
                type="button"
                disabled={pending}
                onClick={() => add(content.id)}
                className="focus-ring group overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-accent disabled:opacity-50"
              >
                <div className="relative aspect-square bg-ink-100">
                  {content.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={content.previewUrl}
                      alt={content.title}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-ink-300">
                      <Grid3x3 className="size-5" aria-hidden />
                    </div>
                  )}
                  <TypeMark type={content.type} />
                </div>
                <p className="truncate px-2 py-1.5 text-xs text-ink-700">{content.title}</p>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <QuickFeedUpload clientId={clientId} open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
