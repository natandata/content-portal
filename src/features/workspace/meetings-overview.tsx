import { MeetingsOverviewClient } from "@/components/meetings/meetings-overview-client";
import { Card, PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadProfessionalMeetings } from "@/server/queries";

/**
 * Todas as reunioes do profissional, de todos os clientes, num lugar so —
 * complementa a aba "Reunioes" de cada cliente (que so mostra as dele).
 * Admin nao tem clientes proprios, entao nao ha o que juntar aqui.
 */
export async function MeetingsOverview() {
  const actor = await requireStaff();

  if (actor.role !== "professional") {
    return (
      <>
        <PageHeader title="Reunioes" description="Visao de todas as reunioes, por profissional." />
        <Card>
          <p className="text-sm text-ink-500">
            Cada profissional gerencia as proprias reunioes aqui. Para ver as de um cliente especifico, abra o
            cliente em Clientes e va na aba Reunioes.
          </p>
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const meetings = await loadProfessionalMeetings(supabase, actor.authUser.id);
  const base = basePath(actor.role);

  const withHrefs = meetings.map((meeting) => ({
    ...meeting,
    clientHref: `${base}/clients/${meeting.client_id}`,
  }));

  return (
    <>
      <PageHeader
        title="Reunioes"
        description="Passadas, presentes e futuras — de todos os seus clientes."
      />
      <MeetingsOverviewClient meetings={withHrefs} />
    </>
  );
}
