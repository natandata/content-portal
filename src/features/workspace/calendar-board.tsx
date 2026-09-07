import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_TONE, type BadgeTone } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { loadClientNames, loadProfessionalClientIds, loadProfessionalMeetings } from "@/server/queries";
import type { MeetingStatus, TaskRow, TaskStatus } from "@/types/database";

/** Post agendado, tarefa com prazo ou reuniao com data — o calendario trata os tres igual. */
export interface CalendarEntry {
  id: string;
  kind: "post" | "task" | "meeting";
  title: string;
  /** Nome do cliente, quando houver. */
  subtitle: string | null;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM:SS — tarefa nunca tem hora, so prazo. */
  time: string | null;
  statusLabel: string;
  tone: BadgeTone;
  /** So em reunioes — clicar leva para a pagina do cliente. */
  clientId?: string;
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

const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  pending: "Aguardando resposta",
  approved: "Confirmada",
  declined: "Recusada",
  cancelled: "Cancelada",
  scheduled: "Agendada",
};

const MEETING_STATUS_TONE: Record<MeetingStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  declined: "danger",
  cancelled: "neutral",
  scheduled: "success",
};

/**
 * `scheduled_start` e um timestamptz; o app nao guarda o fuso de cada
 * profissional, entao projeta no fuso de Brasilia (publico-alvo do produto
 * hoje) em vez do fuso do servidor (Vercel roda em UTC — usar isso
 * empurraria reunioes de noite para o dia seguinte no calendario).
 */
function saoPauloDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function saoPauloTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

export async function CalendarBoard() {
  const actor = await requireStaff();
  const supabase = await createClient();

  const clientIds = await loadProfessionalClientIds(supabase, actor.authUser.id);

  const [{ data: contents }, { data: tasks }, meetingRows] = await Promise.all([
    clientIds.length > 0
      ? supabase
          .from("contents")
          .select("id, title, client_id, status, scheduled_date, scheduled_time")
          .in("client_id", clientIds)
          .not("scheduled_date", "is", null)
      : Promise.resolve({ data: [] }),
    supabase
      .from("tasks")
      .select("*")
      .eq("professional_id", actor.authUser.id)
      .not("due_date", "is", null),
    loadProfessionalMeetings(supabase, actor.authUser.id),
  ]);

  const contentRows = contents ?? [];
  const taskRows: TaskRow[] = tasks ?? [];

  const clientOptions = clientIds.length > 0
    ? await (async () => {
        const { data } = await supabase
          .from("clients")
          .select("id, company_name")
          .in("id", clientIds)
          .order("company_name");
        return (data ?? []).map((client) => ({ id: client.id, companyName: client.company_name }));
      })()
    : [];

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

  // So o metodo Calendly tem timestamptz de verdade — google_meet usa a data
  // e hora propostas direto (colunas `date`/`time` puras, sem fuso).
  const meetingEntries: CalendarEntry[] = meetingRows.flatMap((meeting) => {
    let date: string | null = null;
    let time: string | null = null;

    if (meeting.method === "calendly") {
      if (meeting.scheduled_start) {
        date = saoPauloDateKey(meeting.scheduled_start);
        time = saoPauloTime(meeting.scheduled_start);
      }
    } else if (meeting.proposed_date && meeting.proposed_time) {
      date = meeting.proposed_date;
      time = meeting.proposed_time;
    }

    // Pedido do Calendly ainda sem horario marcado nao tem o que mostrar
    // aqui — fica so na lista de Reunioes, como ja e o caso hoje.
    if (!date) return [];

    return [
      {
        id: meeting.id,
        kind: "meeting",
        title: meeting.clientName,
        subtitle: MEETING_STATUS_LABEL[meeting.status],
        date,
        time,
        statusLabel: MEETING_STATUS_LABEL[meeting.status],
        tone: MEETING_STATUS_TONE[meeting.status],
        clientId: meeting.client_id,
      },
    ];
  });

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Posts agendados, prazos de tarefas e reunioes, em visao de Mes, Semana ou Dia."
      />
      <CalendarView
        posts={posts}
        tasks={taskEntries}
        meetings={meetingEntries}
        taskRows={taskRows}
        clientOptions={clientOptions}
      />
    </>
  );
}
