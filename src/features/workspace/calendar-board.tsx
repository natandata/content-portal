import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadClientNames, loadProfessionalClientIds } from "@/server/queries";
import type { ContentStatus } from "@/types/database";

export interface CalendarPost {
  id: string;
  title: string;
  clientName: string;
  status: ContentStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
}

export async function CalendarBoard() {
  const actor = await requireStaff();
  const supabase = await createClient();

  const clientIds = await loadProfessionalClientIds(supabase, actor.authUser.id);

  const { data: contents } =
    clientIds.length > 0
      ? await supabase
          .from("contents")
          .select("id, title, client_id, status, scheduled_date, scheduled_time")
          .in("client_id", clientIds)
          .not("scheduled_date", "is", null)
      : { data: [] };

  const rows = contents ?? [];
  const names = await loadClientNames(
    supabase,
    rows.map((row) => row.client_id),
  );

  const posts: CalendarPost[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    clientName: names.get(row.client_id) ?? "Cliente",
    status: row.status,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
  }));

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Posts organizados por dia, com visao de Mes, Semana e Dia — inclui horario."
      />
      <CalendarView posts={posts} />
    </>
  );
}
