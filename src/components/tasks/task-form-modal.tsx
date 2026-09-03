"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";
import type { TaskRow } from "@/types/database";

export interface ClientOption {
  id: string;
  companyName: string;
}

/**
 * Mesmo modal cria e edita: em edicao chega com `task` preenchido e um
 * `trigger` custom (o item da lista cuida de abrir); em criacao usa o botao
 * padrao "Nova tarefa".
 */
export function TaskFormModal({
  clients,
  task,
  trigger,
}: {
  clients: ClientOption[];
  task?: TaskRow;
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const isEditing = Boolean(task);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [clientId, setClientId] = useState(task?.client_id ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    if (isEditing) return;
    setTitle("");
    setDescription("");
    setClientId("");
    setDueDate("");
  }

  async function submit() {
    setError(null);

    if (title.trim().length < 2) {
      setError("Informe o titulo da tarefa.");
      return;
    }

    setBusy(true);
    try {
      const payload = { title, description, clientId, dueDate };
      const result = task
        ? await updateTaskAction(task.id, payload)
        : await createTaskAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(isEditing ? "Tarefa atualizada." : "Tarefa criada.");
      setOpen(false);
      reset();
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

            <Field label="Prazo (opcional)" htmlFor="task-due-date">
              <Input
                id="task-due-date"
                type="date"
                value={dueDate ?? ""}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={busy}
              />
            </Field>
          </div>

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
