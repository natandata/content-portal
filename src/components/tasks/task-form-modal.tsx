"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  createTaskAction,
  deleteTaskAction,
  setTaskStatusAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import type { TaskRow, TaskStatus } from "@/types/database";

export interface ClientOption {
  id: string;
  companyName: string;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "A Fazer",
  in_progress: "Em Andamento",
  waiting: "Aguardando",
  done: "Concluida",
};

/**
 * Mesmo modal cria e edita. Uso normal: passa `trigger` e o proprio modal
 * controla se esta aberto. Uso pelo quadro Kanban (sem trigger visivel — o
 * clique no card ou no "+ Adicionar tarefa" e que abre): passa `forceOpen` +
 * `onOpenChange`, e o trigger vira `() => null`.
 */
export function TaskFormModal({
  clients,
  task,
  trigger,
  forceOpen,
  onOpenChange,
}: {
  clients: ClientOption[];
  task?: TaskRow;
  trigger?: (open: () => void) => React.ReactNode;
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(task);
  const controlled = forceOpen !== undefined;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? Boolean(forceOpen) : internalOpen;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [clientId, setClientId] = useState(task?.client_id ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [tag, setTag] = useState(task?.tag ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "pending");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reabrir (ou trocar de task, no quadro) parte sempre dos valores salvos.
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setClientId(task?.client_id ?? "");
    setDueDate(task?.due_date ?? "");
    setTag(task?.tag ?? "");
    setStatus(task?.status ?? "pending");
    setError(null);
  }, [open, task]);

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  async function submit() {
    setError(null);

    if (title.trim().length < 2) {
      setError("Informe o titulo da tarefa.");
      return;
    }

    setBusy(true);
    try {
      const payload = { title, description, clientId, dueDate, tag };
      const result = task
        ? await updateTaskAction(task.id, payload)
        : await createTaskAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Editando e o status mudou no proprio formulario (fora do drag-and-drop).
      if (task && status !== task.status) {
        await setTaskStatusAction(task.id, status);
      }

      toast.success(isEditing ? "Tarefa atualizada." : "Tarefa criada.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setBusy(true);
    try {
      const result = await deleteTaskAction(task.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarefa excluida.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Nova tarefa
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={isEditing ? "Editar tarefa" : "Nova tarefa"}
        footer={
          <>
            {isEditing ? (
              <Button
                variant="ghost"
                onClick={() => void handleDelete()}
                disabled={busy}
                className="mr-auto text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
                Excluir
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              {isEditing ? "Salvar alteracoes" : "Criar tarefa"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Titulo" htmlFor="task-title" required>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              autoFocus
            />
          </Field>

          <Field label="Descricao" htmlFor="task-description">
            <Textarea
              id="task-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={busy}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Etiqueta (opcional)" htmlFor="task-tag" hint='Ex.: "Urgente", "Financeiro"'>
              <Input
                id="task-tag"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                disabled={busy}
              />
            </Field>

            {isEditing ? (
              <Field label="Coluna" htmlFor="task-status">
                <Select
                  id="task-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as TaskStatus)}
                  disabled={busy}
                >
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABEL[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Prazo (opcional)" htmlFor="task-due-date">
                <Input
                  id="task-due-date"
                  type="date"
                  value={dueDate ?? ""}
                  onChange={(event) => setDueDate(event.target.value)}
                  disabled={busy}
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente (opcional)" htmlFor="task-client">
              <Select
                id="task-client"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                disabled={busy}
              >
                <option value="">Sem cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName}
                  </option>
                ))}
              </Select>
            </Field>

            {isEditing ? (
              <Field label="Prazo (opcional)" htmlFor="task-due-date-edit">
                <Input
                  id="task-due-date-edit"
                  type="date"
                  value={dueDate ?? ""}
                  onChange={(event) => setDueDate(event.target.value)}
                  disabled={busy}
                />
              </Field>
            ) : null}
          </div>

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
