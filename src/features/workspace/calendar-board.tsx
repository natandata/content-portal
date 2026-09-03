import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE, type BadgeTone } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { loadClientNames, loadProfessionalClientIds } from "@/server/queries";
import type { TaskStatus } from "@/types/database";

/** Post agendado ou tarefa com prazo — o calendario trata os dois igual. */
export interface CalendarEntry {
  id: string;
  kind: "post" | "task";
  title: string;
  /** Nome do cliente, quando houver. */
  subtitle: string | null;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM:SS — tarefa nunca tem hora, so prazo. */
  time: string | null;
  statusLabel: string;
  tone: BadgeTone;
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "A Fazer",
  in_progress: "Em Andamento",
  waiting: "Aguardando",
  done: "Concluida",
};

const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  pending: "neutral",
  in_progress: "info",
  waiting: "warning",
  done: "success",
};

export async function CalendarBoard() {
  const actor = await requireStaff();
  const supabase = await createClient();

  const clientIds = await loadProfessionalClientIds(supabase, actor.authUser.id);

  const [{ data: contents }, { data: tasks }] = await Promise.all([
    clientIds.length > 0
      ? supabase
          .from("contents")
          .select("id, title, client_id, status, scheduled_date, scheduled_time")
          .in("client_id", clientIds)
          .not("scheduled_date", "is", null)
      : Promise.resolve({ data: [] }),
    supabase
      .from("tasks")
      .select("id, title, client_id, status, due_date")
      .eq("professional_id", actor.authUser.id)
      .not("due_date", "is", null),
  ]);

  const contentRows = contents ?? [];
  const taskRows = tasks ?? [];

  const names = await loadClientNames(supabase, [
    ...contentRows.map((row) => row.client_id),
    ...taskRows.map((row) => row.client_id).filter((id): id is string => Boolean(id)),
  ]);

  const posts: CalendarEntry[] = contentRows
    .filter((row): row is typeof row & { scheduled_date: string } => Boolean(row.scheduled_date))
    .map((row) => ({
      id: row.id,
      kind: "post",
      title: row.title,
      subtitle: names.get(row.client_id) ?? "Cliente",
      date: row.scheduled_date,
      time: row.scheduled_time,
      statusLabel: CONTENT_STATUS_LABEL[row.status],
      tone: CONTENT_STATUS_TONE[row.status],
    }));

  const taskEntries: CalendarEntry[] = taskRows
    .filter((row): row is typeof row & { due_date: string } => Boolean(row.due_date))
    .map((row) => ({
      id: row.id,
      kind: "task",
      title: row.title,
      subtitle: row.client_id ? (names.get(row.client_id) ?? null) : null,
      date: row.due_date,
      time: null,
      statusLabel: TASK_STATUS_LABEL[row.status],
      tone: TASK_STATUS_TONE[row.status],
    }));

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Posts agendados e prazos de tarefas, em visao de Mes, Semana ou Dia."
      />
      <CalendarView posts={posts} tasks={taskEntries} />
    </>
  );
}
