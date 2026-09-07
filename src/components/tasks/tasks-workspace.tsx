"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Brain,
  Calendar as CalendarIcon,
  GanttChartSquare,
  LayoutGrid,
  List as ListIcon,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { TaskCard } from "@/components/tasks/task-card";
import { TaskFormModal, type ClientOption } from "@/components/tasks/task-form-modal";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { tagColorClass } from "@/lib/tag-colors";
import { cn, formatDate } from "@/lib/utils";
import { setTaskStatusAction } from "@/server/actions/tasks";
import type { TaskRow, TaskStatus } from "@/types/database";

type ViewMode = "board" | "list" | "timeline" | "gantt" | "mindmap" | "workload";

const STATUS_ORDER: TaskStatus[] = ["pending", "in_progress", "waiting", "done"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "A Fazer",
  in_progress: "Em Andamento",
  waiting: "Aguardando",
  done: "Concluida",
};

/** Classes `bg-*` — reaproveitadas como `fill-*` no mapa mental (mesma paleta). */
const STATUS_DOT: Record<TaskStatus, string> = {
  pending: "bg-ink-400",
  in_progress: "bg-accent",
  waiting: "bg-amber-500",
  done: "bg-emerald-500",
};

const STATUS_FILL: Record<TaskStatus, string> = {
  pending: "fill-ink-400",
  in_progress: "fill-accent",
  waiting: "fill-amber-500",
  done: "fill-emerald-500",
};

const VIEWS: { id: ViewMode; label: string; icon: LucideIcon }[] = [
  { id: "board", label: "Painel", icon: LayoutGrid },
  { id: "list", label: "Lista", icon: ListIcon },
  { id: "timeline", label: "Timeline", icon: CalendarIcon },
  { id: "gantt", label: "Gantt", icon: GanttChartSquare },
  { id: "mindmap", label: "Mapa Mental", icon: Brain },
  { id: "workload", label: "Workload", icon: Users },
];

/**
 * Seis jeitos de olhar a mesma lista de tarefas. So o Painel mexe no status
 * por arrastar; as outras cinco sao leitura + atalho pra abrir o modal (a
 * Lista tambem deixa trocar o status direto, sem abrir nada).
 *
 * Duas visualizacoes usam dados que o modelo hoje nao tem de verdade:
 * - Gantt: sem uma data de "inicio" por tarefa, a barra vai de `created_at`
 *   (quando a tarefa nasceu) ate `due_date` (o prazo) — real, so nao e bem
 *   "quando o trabalho comeca".
 * - Workload: sem responsavel por tarefa (profissional so tem uma pessoa
 *   hoje), virou "carga por semana" — quantas tarefas em aberto vencem em
 *   cada semana, cor por status.
 */
export function TasksWorkspace({
  tasks,
  clients,
  clientNames,
}: {
  tasks: TaskRow[];
  clients: ClientOption[];
  clientNames: Map<string, string>;
}) {
  const [view, setView] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) if (task.tag) set.add(task.tag);
    return Array.from(set).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (tagFilter && task.tag !== tagFilter) return false;
      if (!query) return true;
      const clientName = task.client_id ? (clientNames.get(task.client_id) ?? "") : "";
      return (
        task.title.toLowerCase().includes(query) ||
        clientName.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [tasks, search, tagFilter, clientNames]);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
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

      <div className="mb-4 flex w-fit flex-wrap rounded-lg border border-line bg-ink-50 p-0.5">
        {VIEWS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              className={cn(
                "focus-ring flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                view === option.id
                  ? "bg-surface text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-800",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {option.label}
            </button>
          );
        })}
      </div>

      {view === "board" ? (
        <BoardView
          tasks={filtered}
          clientNames={clientNames}
          onOpen={setEditingTask}
          onCreate={() => setCreateOpen(true)}
        />
      ) : view === "list" ? (
        <ListView tasks={filtered} clientNames={clientNames} onOpen={setEditingTask} />
      ) : view === "timeline" ? (
        <TimelineView tasks={filtered} clientNames={clientNames} onOpen={setEditingTask} />
      ) : view === "gantt" ? (
        <GanttView tasks={filtered} clientNames={clientNames} onOpen={setEditingTask} />
      ) : view === "mindmap" ? (
        <MindMapView tasks={filtered} clientNames={clientNames} onOpen={setEditingTask} />
      ) : (
        <WorkloadView tasks={filtered} />
      )}

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
      <TaskFormModal clients={clients} trigger={() => null} forceOpen={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function BoardView({
  tasks,
  clientNames,
  onOpen,
  onCreate,
}: {
  tasks: TaskRow[];
  clientNames: Map<string, string>;
  onOpen: (task: TaskRow) => void;
  onCreate: () => void;
}) {
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  /** Coluna que o card ja "ocupa" na tela antes do servidor confirmar. */
  const [pendingMoves, setPendingMoves] = useState<Map<string, TaskStatus>>(new Map());

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

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskRow[]>();
    for (const status of STATUS_ORDER) map.set(status, []);
    for (const task of visibleTasks) map.get(task.status)?.push(task);
    return map;
  }, [visibleTasks]);

  function moveTask(taskId: string, status: TaskStatus) {
    const current = visibleTasks.find((task) => task.id === taskId);
    if (!current || current.status === status) return;

    setPendingMoves((prev) => new Map(prev).set(taskId, status));

    void setTaskStatusAction(taskId, status).then((result) => {
      if (!result.ok) {
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
    <div className="scroll-slim -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {STATUS_ORDER.map((status) => {
        const items = byStatus.get(status) ?? [];
        const isDragOver = dragOverStatus === status;

        return (
          <div
            key={status}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverStatus((prev) => (prev === status ? prev : status));
            }}
            onDragLeave={() => setDragOverStatus((prev) => (prev === status ? null : prev))}
            onDrop={(event) => {
              event.preventDefault();
              setDragOverStatus(null);
              const taskId = event.dataTransfer.getData("text/plain");
              if (taskId) moveTask(taskId, status);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border border-line bg-ink-50/40 p-2.5 transition",
              isDragOver && "border-accent bg-accent-soft/40",
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
                <h3 className="text-sm font-semibold text-ink-900">{STATUS_LABEL[status]}</h3>
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
                  onOpen={() => onOpen(task)}
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
                onClick={onCreate}
                className="focus-ring rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
              >
                + Adicionar tarefa
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({
  tasks,
  clientNames,
  onOpen,
}: {
  tasks: TaskRow[];
  clientNames: Map<string, string>;
  onOpen: (task: TaskRow) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.status !== b.status) return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }),
    [tasks],
  );

  function changeStatus(taskId: string, status: TaskStatus) {
    start(async () => {
      const result = await setTaskStatusAction(taskId, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (sorted.length === 0) {
    return (
      <EmptyState icon={<ListIcon className="size-5" />} title="Nenhuma tarefa" description="Ajuste a busca ou os filtros." />
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase">
            <tr>
              <th className="px-4 py-2.5">Tarefa</th>
              <th className="px-4 py-2.5">Cliente</th>
              <th className="px-4 py-2.5">Tag</th>
              <th className="px-4 py-2.5">Prazo</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((task) => {
              const overdue =
                task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10);
              const clientName = task.client_id ? clientNames.get(task.client_id) : undefined;

              return (
                <tr key={task.id} className="transition hover:bg-ink-50">
                  <td className="max-w-[280px] px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpen(task)}
                      className="focus-ring block w-full truncate text-left font-medium text-ink-900 hover:text-accent"
                    >
                      {task.title}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{clientName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {task.tag ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                          tagColorClass(task.tag),
                        )}
                      >
                        {task.tag}
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className={cn("px-4 py-2.5 tabular-nums", overdue ? "font-medium text-red-600" : "text-ink-600")}>
                    {task.due_date ? formatDate(task.due_date) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={task.status}
                      disabled={pending}
                      onChange={(event) => changeStatus(task.id, event.target.value as TaskStatus)}
                      className="h-8 w-[150px] text-xs"
                    >
                      {STATUS_ORDER.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimelineView({
  tasks,
  clientNames,
  onOpen,
}: {
  tasks: TaskRow[];
  clientNames: Map<string, string>;
  onOpen: (task: TaskRow) => void;
}) {
  const buckets = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().slice(0, 10);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
    const weekEndKey = weekEnd.toISOString().slice(0, 10);

    const groups: { id: string; label: string; tasks: TaskRow[] }[] = [
      { id: "overdue", label: "Atrasadas", tasks: [] },
      { id: "today", label: "Hoje", tasks: [] },
      { id: "tomorrow", label: "Amanha", tasks: [] },
      { id: "week", label: "Esta semana", tasks: [] },
      { id: "later", label: "Mais adiante", tasks: [] },
      { id: "none", label: "Sem prazo", tasks: [] },
    ];
    const byId = new Map(groups.map((group) => [group.id, group]));

    for (const task of tasks) {
      if (!task.due_date) {
        byId.get("none")!.tasks.push(task);
      } else if (task.due_date < todayKey && task.status !== "done") {
        byId.get("overdue")!.tasks.push(task);
      } else if (task.due_date === todayKey) {
        byId.get("today")!.tasks.push(task);
      } else if (task.due_date === tomorrowKey) {
        byId.get("tomorrow")!.tasks.push(task);
      } else if (task.due_date <= weekEndKey) {
        byId.get("week")!.tasks.push(task);
      } else {
        byId.get("later")!.tasks.push(task);
      }
    }

    for (const group of groups) group.tasks.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    return groups.filter((group) => group.tasks.length > 0);
  }, [tasks]);

  if (buckets.length === 0) {
    return (
      <EmptyState icon={<CalendarIcon className="size-5" />} title="Nenhuma tarefa" description="Ajuste a busca ou os filtros." />
    );
  }

  return (
    <div className="space-y-6">
      {buckets.map((group) => (
        <section key={group.id}>
          <h3
            className={cn(
              "mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase",
              group.id === "overdue" ? "text-red-600" : "text-ink-500",
            )}
          >
            {group.id === "overdue" ? <AlertTriangle className="size-3.5" aria-hidden /> : null}
            {group.label} ({group.tasks.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                clientName={task.client_id ? clientNames.get(task.client_id) : undefined}
                onOpen={() => onOpen(task)}
                onDragStart={() => {}}
                onDragEnd={() => {}}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GanttView({
  tasks,
  clientNames,
  onOpen,
}: {
  tasks: TaskRow[];
  clientNames: Map<string, string>;
  onOpen: (task: TaskRow) => void;
}) {
  const dated = useMemo(() => tasks.filter((task) => task.due_date), [tasks]);
  const undated = useMemo(() => tasks.filter((task) => !task.due_date), [tasks]);

  // O eixo e governado pelos PRAZOS, nao por quando a tarefa nasceu: uma
  // tarefa criada meses atras (mas com prazo proximo) nao pode esticar o
  // grafico inteiro e espremer todas as outras barras numa fatia minuscula.
  // O inicio de cada barra ainda usa `created_at`, so que "cortado" na borda
  // esquerda do eixo quando for mais antigo que ela.
  const range = useMemo(() => {
    if (dated.length === 0) return null;
    const now = Date.now();
    let minDue = Infinity;
    let maxDue = -Infinity;
    for (const task of dated) {
      const due = new Date(task.due_date!).getTime();
      if (due < minDue) minDue = due;
      if (due > maxDue) maxDue = due;
    }
    const DAY = 24 * 60 * 60 * 1000;
    const min = Math.min(minDue, now) - 3 * DAY;
    const max = maxDue + 3 * DAY;
    return { min, max };
  }, [dated]);

  const weekMarks = useMemo(() => {
    if (!range) return [];
    const totalMs = range.max - range.min;
    const marks: { label: string; leftPct: number }[] = [];
    const cursor = new Date(range.min);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= range.max) {
      marks.push({
        label: cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        leftPct: ((cursor.getTime() - range.min) / totalMs) * 100,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return marks;
  }, [range]);

  const sorted = useMemo(() => [...dated].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")), [dated]);

  if (!range) {
    return (
      <EmptyState
        icon={<GanttChartSquare className="size-5" />}
        title="Nenhuma tarefa com prazo"
        description="O Gantt precisa de um prazo para desenhar a barra — defina um prazo nas tarefas."
      />
    );
  }

  const totalMs = range.max - range.min;
  const pct = (time: number) => ((time - range.min) / totalMs) * 100;
  const days = Math.max(1, Math.round(totalMs / 86_400_000));

  return (
    <div>
      {undated.length > 0 ? (
        <p className="mb-3 text-xs text-ink-500">{undated.length} sem prazo — nao aparecem no Gantt.</p>
      ) : null}
      <div className="card overflow-x-auto p-0">
        <div style={{ minWidth: Math.max(700, days * 40) }}>
          <div className="relative h-9 border-b border-line bg-ink-50">
            {weekMarks.map((mark, index) => (
              <div
                key={index}
                className="absolute top-0 h-full border-l border-line px-2 text-[11px] leading-9 text-ink-500"
                style={{ left: `${mark.leftPct}%` }}
              >
                {mark.label}
              </div>
            ))}
            <div className="absolute top-0 h-full border-l-2 border-accent" style={{ left: `${pct(Date.now())}%` }} />
          </div>

          <div className="divide-y divide-line">
            {sorted.map((task) => {
              const rawStart = new Date(task.created_at.slice(0, 10)).getTime();
              const end = new Date(task.due_date!).getTime();
              const start = Math.max(Math.min(rawStart, end), range.min);
              const left = pct(start);
              const width = Math.max(3, pct(Math.max(end, start)) - left);
              const clientName = task.client_id ? clientNames.get(task.client_id) : undefined;

              return (
                <div key={task.id} className="relative flex h-12 items-center">
                  <button
                    type="button"
                    onClick={() => onOpen(task)}
                    title={task.title}
                    className={cn(
                      "focus-ring absolute flex h-7 items-center truncate rounded-md px-2.5 text-xs font-medium text-white transition hover:brightness-110",
                      STATUS_DOT[task.status],
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="truncate">
                      {task.title}
                      {clientName ? ` · ${clientName}` : ""}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MindMapView({
  tasks,
  clientNames,
  onOpen,
}: {
  tasks: TaskRow[];
  clientNames: Map<string, string>;
  onOpen: (task: TaskRow) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      const key = task.client_id ?? "__none__";
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .map(([clientId, items]) => ({
        clientId,
        name: clientId === "__none__" ? "Sem cliente" : (clientNames.get(clientId) ?? "Cliente"),
        tasks: items,
      }))
      .sort((a, b) => b.tasks.length - a.tasks.length);
  }, [tasks, clientNames]);

  if (groups.length === 0) {
    return (
      <EmptyState icon={<Brain className="size-5" />} title="Nenhuma tarefa" description="Ajuste a busca ou os filtros." />
    );
  }

  const CX = 500;
  const CY = 380;
  const R1 = 190;
  const R2 = 100;
  const MAX_VISIBLE = 6;
  const angleStep = (2 * Math.PI) / groups.length;

  return (
    <div className="card overflow-x-auto p-4">
      <svg viewBox="0 0 1000 760" className="w-full" style={{ minWidth: 700 }}>
        {groups.map((group, groupIndex) => {
          const angle = groupIndex * angleStep - Math.PI / 2;
          const cx = CX + R1 * Math.cos(angle);
          const cy = CY + R1 * Math.sin(angle);
          const visible = group.tasks.slice(0, MAX_VISIBLE);
          const extra = group.tasks.length - visible.length;
          const spread = Math.PI / 3;

          return (
            <g key={group.clientId}>
              <line x1={CX} y1={CY} x2={cx} y2={cy} stroke="var(--color-line)" strokeWidth={1.5} />

              {visible.map((task, taskIndex) => {
                const taskAngle =
                  visible.length > 1 ? angle - spread / 2 + (spread * taskIndex) / (visible.length - 1) : angle;
                const tx = cx + R2 * Math.cos(taskAngle);
                const ty = cy + R2 * Math.sin(taskAngle);
                const label = task.title.length > 18 ? `${task.title.slice(0, 16)}…` : task.title;

                return (
                  <g key={task.id} className="cursor-pointer" onClick={() => onOpen(task)}>
                    <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="var(--color-line)" strokeWidth={1} />
                    <circle cx={tx} cy={ty} r={5} className={STATUS_FILL[task.status]} />
                    <text x={tx} y={ty} dy={-9} textAnchor="middle" fontSize={10} className="fill-ink-700">
                      {label}
                    </text>
                  </g>
                );
              })}

              {extra > 0 ? (
                <text x={cx} y={cy + R2 + 16} textAnchor="middle" fontSize={10} className="fill-ink-400">
                  +{extra} mais
                </text>
              ) : null}

              <circle cx={cx} cy={cy} r={24} className="fill-ink-100 stroke-ink-300" strokeWidth={1} />
              <text x={cx} y={cy} dy={4} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-ink-900">
                {group.name.length > 14 ? `${group.name.slice(0, 12)}…` : group.name}
              </text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r={46} className="fill-ink-900" />
        <text x={CX} y={CY} dy={5} textAnchor="middle" fontSize={13} fontWeight={700} fill="white">
          Tarefas
        </text>
      </svg>
    </div>
  );
}

function WorkloadView({ tasks }: { tasks: TaskRow[] }) {
  const rows = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "done");
    const todayKey = new Date().toISOString().slice(0, 10);
    const overdue = open.filter((task) => task.due_date && task.due_date < todayKey);
    const noDate = open.filter((task) => !task.due_date);

    const weeks: { label: string; tasks: TaskRow[] }[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() - cursor.getDay());

    for (let i = 0; i < 6; i++) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + 6);
      const startKey = start.toISOString().slice(0, 10);
      const endKey = end.toISOString().slice(0, 10);
      const lowerBound = startKey < todayKey ? todayKey : startKey;

      weeks.push({
        label: i === 0 ? "Esta semana" : `Semana de ${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`,
        tasks: open.filter((task) => task.due_date && task.due_date >= lowerBound && task.due_date <= endKey),
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return [
      { label: "Atrasadas", tasks: overdue, tone: "danger" as const },
      ...weeks.map((week) => ({ ...week, tone: "default" as const })),
      { label: "Sem prazo", tasks: noDate, tone: "muted" as const },
    ];
  }, [tasks]);

  const max = Math.max(1, ...rows.map((row) => row.tasks.length));

  if (tasks.length === 0) {
    return (
      <EmptyState icon={<Users className="size-5" />} title="Nenhuma tarefa" description="Ajuste a busca ou os filtros." />
    );
  }

  return (
    <div className="card space-y-4">
      {rows.map((row) => {
        const counts = STATUS_ORDER.map((status) => ({
          status,
          count: row.tasks.filter((task) => task.status === status).length,
        }));

        return (
          <div key={row.label} className="flex items-center gap-4">
            <span
              className={cn(
                "w-36 shrink-0 text-sm font-medium",
                row.tone === "danger" ? "text-red-600" : row.tone === "muted" ? "text-ink-400" : "text-ink-600",
              )}
            >
              {row.label}
            </span>
            <div className="flex h-7 flex-1 overflow-hidden rounded-md bg-ink-50">
              {counts.map(({ status, count }) =>
                count === 0 ? null : (
                  <div
                    key={status}
                    className={STATUS_DOT[status]}
                    style={{ width: `${(count / max) * 100}%` }}
                    title={`${STATUS_LABEL[status]}: ${count}`}
                  />
                ),
              )}
            </div>
            <span className="w-8 shrink-0 text-right text-sm text-ink-500 tabular-nums">{row.tasks.length}</span>
          </div>
        );
      })}
      <p className="pt-2 text-xs text-ink-400">
        Carga de tarefas em aberto por semana — a cor mostra o status (cinza: a fazer, azul: em andamento, amarelo:
        aguardando).
      </p>
    </div>
  );
}
