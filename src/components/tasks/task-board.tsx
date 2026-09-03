"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { TaskCard } from "@/components/tasks/task-card";
import { TaskFormModal, type ClientOption } from "@/components/tasks/task-form-modal";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { setTaskStatusAction } from "@/server/actions/tasks";
import type { TaskRow, TaskStatus } from "@/types/database";

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "pending", label: "A Fazer", dot: "bg-ink-400" },
  { status: "in_progress", label: "Em Andamento", dot: "bg-accent" },
  { status: "waiting", label: "Aguardando", dot: "bg-amber-500" },
  { status: "done", label: "Concluida", dot: "bg-emerald-500" },
];

export function TaskBoard({
  tasks,
  clients,
  clientNames,
}: {
  tasks: TaskRow[];
  clients: ClientOption[];
  clientNames: Map<string, string>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  /**
   * Coluna que o card ja "ocupa" na tela antes do servidor confirmar. Sem
   * isso o card so pula de coluna depois do round-trip + refresh, o que da a
   * sensacao de arrasto travado.
   */
  const [pendingMoves, setPendingMoves] = useState<Map<string, TaskStatus>>(new Map());

  // Quando os dados do servidor chegam ja com o status novo, a marcacao
  // local perde a razao de existir — descartar evita segurar dado velho.
  useEffect(() => {
    setPendingMoves((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const task of tasks) {
        if (next.get(task.id) === task.status) next.delete(task.id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  const visibleTasks = useMemo(
    () =>
      pendingMoves.size === 0
        ? tasks
        : tasks.map((task) => {
            const moved = pendingMoves.get(task.id);
            return moved ? { ...task, status: moved } : task;
          }),
    [tasks, pendingMoves],
  );

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) {
      if (task.tag) set.add(task.tag);
    }
    return Array.from(set).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleTasks.filter((task) => {
      if (tagFilter && task.tag !== tagFilter) return false;
      if (!query) return true;
      const clientName = task.client_id ? (clientNames.get(task.client_id) ?? "") : "";
      return (
        task.title.toLowerCase().includes(query) ||
        clientName.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [visibleTasks, search, tagFilter, clientNames]);

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskRow[]>();
    for (const column of COLUMNS) map.set(column.status, []);
    for (const task of filtered) {
      map.get(task.status)?.push(task);
    }
    return map;
  }, [filtered]);

  function moveTask(taskId: string, status: TaskStatus) {
    const current = visibleTasks.find((task) => task.id === taskId);
    if (!current || current.status === status) return;

    // Move na tela primeiro; o servidor confirma depois.
    setPendingMoves((prev) => new Map(prev).set(taskId, status));

    void setTaskStatusAction(taskId, status).then((result) => {
      if (!result.ok) {
        // Falhou: desfaz o movimento e devolve o card para a coluna original.
        setPendingMoves((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          return next;
        });
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar tarefa ou cliente..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className={cn(
              "focus-ring rounded-full border px-3 py-1 text-xs font-medium transition",
              tagFilter === null
                ? "border-ink-900 bg-ink-900 text-on-ink"
                : "border-line text-ink-600 hover:bg-ink-50",
            )}
          >
            Todas
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
              className={cn(
                "focus-ring rounded-full border px-3 py-1 text-xs font-medium transition",
                tagFilter === tag
                  ? "border-ink-900 bg-ink-900 text-on-ink"
                  : "border-line text-ink-600 hover:bg-ink-50",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-slim -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {COLUMNS.map((column) => {
          const items = byStatus.get(column.status) ?? [];
          const isDragOver = dragOverStatus === column.status;

          return (
            <div
              key={column.status}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                // dragover dispara dezenas de vezes por segundo: so mexe no
                // estado quando a coluna sob o cursor realmente muda.
                setDragOverStatus((prev) => (prev === column.status ? prev : column.status));
              }}
              onDragLeave={() => setDragOverStatus((prev) => (prev === column.status ? null : prev))}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverStatus(null);
                const taskId = event.dataTransfer.getData("text/plain");
                if (taskId) moveTask(taskId, column.status);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border border-line bg-ink-50/40 p-2.5 transition",
                isDragOver && "border-accent bg-accent-soft/40",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", column.dot)} aria-hidden />
                  <h3 className="text-sm font-semibold text-ink-900">{column.label}</h3>
                  <span className="text-xs text-ink-400">{items.length}</span>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    clientName={task.client_id ? clientNames.get(task.client_id) : undefined}
                    dragging={draggingId === task.id}
                    onOpen={() => setEditingTask(task)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(task.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="focus-ring rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                >
                  + Adicionar tarefa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modais controlados externamente: sem trigger visivel, abrem via estado. */}
      <TaskFormModal
        clients={clients}
        task={editingTask ?? undefined}
        trigger={() => null}
        forceOpen={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
      />
      <TaskFormModal
        clients={clients}
        trigger={() => null}
        forceOpen={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
