import { CheckSquare } from "lucide-react";

import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { TaskItem } from "@/components/tasks/task-item";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadClientNames } from "@/server/queries";

const STATUS_ORDER = { pending: 0, in_progress: 1, done: 2 } as const;

export async function TasksList() {
  const actor = await requireStaff();
  const supabase = await createClient();

  const [{ data: tasks }, { data: clients }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("professional_id", actor.authUser.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("clients")
      .select("id, company_name")
      .eq("professional_id", actor.authUser.id)
      .eq("status", "active")
      .order("company_name"),
  ]);

  const rows = [...(tasks ?? [])].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );

  const clientOptions = (clients ?? []).map((client) => ({
    id: client.id,
    companyName: client.company_name,
  }));

  const names = await loadClientNames(
    supabase,
    rows.map((row) => row.client_id).filter((id): id is string => Boolean(id)),
  );

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Sistema de gestao de tarefas: crie, edite e acompanhe o que precisa ser feito."
        actions={<TaskFormModal clients={clientOptions} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="size-5" />}
          title="Nenhuma tarefa ainda"
          description="Crie a primeira tarefa para comecar a organizar o seu dia a dia."
          action={<TaskFormModal clients={clientOptions} />}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              clientName={task.client_id ? names.get(task.client_id) : undefined}
              clients={clientOptions}
            />
          ))}
        </div>
      )}
    </>
  );
}
