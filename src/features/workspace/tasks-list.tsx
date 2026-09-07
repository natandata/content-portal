import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadClientNames } from "@/server/queries";

export async function TasksList() {
  const actor = await requireStaff();
  const supabase = await createClient();

  const [{ data: tasks }, { data: clients }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("professional_id", actor.authUser.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, company_name")
      .eq("professional_id", actor.authUser.id)
      .eq("status", "active")
      .order("company_name"),
  ]);

  const rows = tasks ?? [];
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
        description="Painel, Lista, Timeline, Gantt, Mapa Mental ou Workload — escolha a visualizacao."
        actions={<TaskFormModal clients={clientOptions} />}
      />

      <TasksWorkspace tasks={rows} clients={clientOptions} clientNames={names} />
    </>
  );
}
