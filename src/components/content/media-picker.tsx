"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, Repeat2, Trash2, Upload } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";
import { MAX_CAROUSEL_SLIDES } from "@/lib/domain";
import { validateFile } from "@/lib/upload";
import { cn, formatBytes } from "@/lib/utils";
import type { ContentType } from "@/types/database";

export interface PickedFile {
  id: string;
  file: File;
  previewUrl: string;
}

const ACCEPT: Record<ContentType, string> = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/quicktime,video/webm",
  carousel: "image/jpeg,image/png,image/webp",
};

function SlideCard({
  item,
  index,
  onRemove,
  onReplace,
  sortable,
}: {
  item: PickedFile;
  index: number;
  onRemove: (id: string) => void;
  onReplace: (id: string) => void;
  sortable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable,
  });

  const isVideo = item.file.type.startsWith("video/");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-line bg-surface",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="relative aspect-square bg-ink-100">
        {isVideo ? (
          <video src={item.previewUrl} className="size-full object-cover" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
        )}

        {isVideo ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Play className="size-8 fill-white/90 text-white/90 drop-shadow" aria-hidden />
          </span>
        ) : null}

        <span className="absolute top-1.5 left-1.5 rounded-md bg-ink-900/80 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
          {index + 1}
        </span>

        {sortable ? (
          <button
            type="button"
            className="absolute top-1.5 right-1.5 cursor-grab rounded-md bg-ink-900/80 p-1 text-white active:cursor-grabbing"
            aria-label={`Mover slide ${index + 1}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-1 border-t border-line px-2 py-1.5">
        <span className="truncate text-[11px] text-ink-500">{formatBytes(item.file.size)}</span>
        <div className="flex shrink-0">
          <IconButton
            label="Substituir arquivo"
            className="size-7"
            onClick={() => onReplace(item.id)}
          >
            <Repeat2 className="size-3.5" />
          </IconButton>
          <IconButton
            label="Remover arquivo"
            className="size-7 hover:text-red-600"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Selecao de arquivos com preview, ordenacao (carrossel), substituicao e
 * remocao antes do envio.
 */
export function MediaPicker({
  type,
  items,
  onChange,
  disabled,
}: {
  type: ContentType;
  items: PickedFile[];
  onChange: (items: PickedFile[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replacingId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const max = type === "carousel" ? MAX_CAROUSEL_SLIDES : 1;
  const kind = type === "video" ? "video" : "image";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => items.map((item) => item.id), [items]);

  // Libera os object URLs ao desmontar para nao vazar memoria.
  useEffect(() => {
    return () => {
      for (const item of items) URL.revokeObjectURL(item.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setError(null);

      const incoming = Array.from(fileList);
      const room = max - items.length;

      if (room <= 0) {
        setError(`Limite de ${max} arquivo(s) atingido.`);
        return;
      }

      const accepted: PickedFile[] = [];
      for (const file of incoming.slice(0, room)) {
        const message = validateFile(file, kind);
        if (message) {
          setError(message);
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (incoming.length > room) {
        setError(`Foram aceitos ${room} arquivo(s): o limite e ${max}.`);
      }

      if (accepted.length > 0) onChange([...items, ...accepted]);
    },
    [items, kind, max, onChange],
  );

  function remove(id: string) {
    const target = items.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(items.filter((item) => item.id !== id));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;

    onChange(arrayMove(items, from, to));
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[type]}
        multiple={type === "carousel"}
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT[type]}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const id = replacingId.current;
          event.target.value = "";
          if (!file || !id) return;

          const message = validateFile(file, kind);
          if (message) {
            setError(message);
            return;
          }

          onChange(
            items.map((item) => {
              if (item.id !== id) return item;
              URL.revokeObjectURL(item.previewUrl);
              return { ...item, file, previewUrl: URL.createObjectURL(file) };
            }),
          );
        }}
      />

      {items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {items.map((item, index) => (
                <SlideCard
                  key={item.id}
                  item={item}
                  index={index}
                  onRemove={remove}
                  onReplace={(id) => {
                    replacingId.current = id;
                    replaceRef.current?.click();
                  }}
                  sortable={type === "carousel"}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      {items.length < max ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            if (!disabled) addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition",
            dragOver ? "border-accent bg-accent-soft" : "border-line bg-ink-50/60",
          )}
        >
          <Upload className="mb-2 size-5 text-ink-400" aria-hidden />
          <p className="text-sm font-medium text-ink-800">
            {type === "carousel" ? "Adicione ate 10 imagens" : "Selecione o arquivo"}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {type === "video"
              ? "MP4, MOV ou WEBM ate 500 MB"
              : "JPG, PNG ou WEBP ate 15 MB por arquivo"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Escolher {type === "carousel" ? "arquivos" : "arquivo"}
          </Button>
        </div>
      ) : null}

      {type === "carousel" && items.length > 1 ? (
        <p className="mt-2 text-xs text-ink-500">
          Arraste pelo icone no canto do slide para reordenar. A ordem exibida e a ordem
          publicada.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
