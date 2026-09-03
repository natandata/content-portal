"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { TaskFormModal, type ClientOption } from "@/components/tasks/task-form-modal";
import { deleteTaskAction, setTaskStatusAction } from "@/server/actions/tasks";
import { cn, formatDate } from "@/lib/utils";
import type { TaskRow, TaskStatus } from "@/types/database";

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluida",
};

const STATUS_TONE: Record<TaskStatus, string> = {
  pending: "text-ink-500",
  in_progress: "text-amber-600",
  done: "text-emerald-600",
};

export function TaskItem({
  task,
  clientName,
  clients,
}: {
  task: TaskRow;
  clientName?: string;
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleStatusChange(status: TaskStatus) {
    setStatusBusy(true);
    try {
      const result = await setTaskStatusAction(task.id, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      const result = await deleteTaskAction(task.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarefa excluida.");
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "truncate text-sm font-semibold text-ink-900",
              task.status === "done" && "text-ink-400 line-through",
            )}
          >
            {task.title}
          </h3>
        </div>
        {task.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-ink-500">{task.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-400">
          {clientName ? <span>{clientName}</span> : null}
          {task.due_date ? (
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" aria-hidden />
              {formatDate(task.due_date)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <Select
            value={task.status}
            disabled={statusBusy}
            onChange={(event) => void handleStatusChange(event.target.value as TaskStatus)}
            className={cn("h-9 text-xs font-medium", STATUS_TONE[task.status])}
          >
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
          {statusBusy ? (
            <Loader2 className="pointer-events-none absolute top-1/2 right-8 size-3.5 -translate-y-1/2 animate-spin text-ink-400" />
          ) : null}
        </div>

        <TaskFormModal
          clients={clients}
          task={task}
          trigger={(openModal) => (
            <IconButton label="Editar tarefa" onClick={openModal}>
              <Pencil className="size-4" />
            </IconButton>
          )}
        />

        <IconButton label="Excluir tarefa" onClick={() => setDeleteOpen(true)} className="text-destructive">
          <Trash2 className="size-4" />
        </IconButton>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => !deleteBusy && setDeleteOpen(false)}
        title="Excluir tarefa"
        description={`Tem certeza que deseja excluir "${task.title}"? Esta acao nao pode ser desfeita.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleteBusy} onClick={() => void handleDelete()}>
              Excluir
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </div>
  );
}
