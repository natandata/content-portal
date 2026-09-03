"use client";

import { Calendar } from "lucide-react";

import { tagColorClass } from "@/lib/tag-colors";
import { cn, formatDate, initials } from "@/lib/utils";
import type { TaskRow } from "@/types/database";

export function TaskCard({
  task,
  clientName,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  task: TaskRow;
  clientName?: string;
  dragging?: boolean;
  onOpen: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const overdue = task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "card focus-ring flex w-full cursor-grab flex-col gap-2 p-3 text-left transition active:cursor-grabbing",
        "hover:border-ink-300",
        dragging && "opacity-40",
      )}
    >
      {task.tag ? (
        <span
          className={cn(
            "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
            tagColorClass(task.tag),
          )}
        >
          {task.tag}
        </span>
      ) : null}

      <h3 className="text-sm font-semibold text-ink-900">{task.title}</h3>

      {task.description ? (
        <p className="line-clamp-2 text-xs text-ink-500">{task.description}</p>
      ) : null}

      {(clientName || task.due_date) ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          {clientName ? (
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ink-500">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[9px] font-semibold text-ink-600">
                {initials(clientName)}
              </span>
              <span className="truncate">{clientName}</span>
            </span>
          ) : (
            <span />
          )}

          {task.due_date ? (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 text-xs",
                overdue ? "font-medium text-red-600" : "text-ink-400",
              )}
            >
              <Calendar className="size-3" aria-hidden />
              {formatDate(task.due_date)}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
