"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Grid3x3, Layers, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { MAX_FEED_ITEMS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { addFeedItemAction, removeFeedItemAction, reorderFeedAction } from "@/server/actions/feed";
import type { ContentType } from "@/types/database";

import type { FeedEntry } from "./feed-grid";

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
}: {
  clientId: string;
  initialEntries: FeedEntry[];
  available: AvailableContent[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => entries.map((entry) => entry.feedItemId), [entries]);
  const emptySlots = Math.max(0, MAX_FEED_ITEMS - entries.length);
  const full = entries.length >= MAX_FEED_ITEMS;

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = entries.findIndex((entry) => entry.feedItemId === active.id);
    const to = entries.findIndex((entry) => entry.feedItemId === over.id);
    if (from < 0 || to < 0) return;

    const next = arrayMove(entries, from, to);
    const previous = entries;
    setEntries(next);

    startTransition(async () => {
      const result = await reorderFeedAction(
        clientId,
        next.map((entry) => entry.contentId),
      );

      if (!result.ok) {
        setEntries(previous);
        toast.error(result.error);
        return;
      }

      toast.success("Feed atualizado.");
      router.refresh();
    });
  }

  function remove(entry: FeedEntry) {
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-500 tabular-nums">
            {entries.length} de {MAX_FEED_ITEMS} posicoes
          </p>
          <Button size="sm" disabled={full || pending} onClick={() => setPickerOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Adicionar
          </Button>
        </div>

        <div className="rounded-xl border border-line bg-surface p-1.5">
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
                    disabled={pending}
                  />
                ))}

                {Array.from({ length: emptySlots }).map((_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="flex aspect-square items-center justify-center border border-dashed border-line bg-ink-50/60 text-[11px] text-ink-300 tabular-nums"
                  >
                    {entries.length + index + 1}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
    </div>
  );
}
