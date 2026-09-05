import { AlertTriangle } from "lucide-react";

import { MeetingRequestForm } from "@/components/meetings/meeting-request-form";
import { MeetingRequestsList } from "@/components/meetings/meeting-requests-list";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadGoogleConnectionStatus } from "@/server/actions/google-connect";
import { loadClientMeetings } from "@/server/queries";

export async function ClientMeetings() {
  const actor = await requireClientActor();
  const { locale, dict } = await getServerDictionary();
  const supabase = await createClient();

  const [meetings, connection] = await Promise.all([
    loadClientMeetings(supabase, actor.client.id),
    actor.client.professional_id
      ? loadGoogleConnectionStatus(actor.client.professional_id)
      : Promise.resolve({ connected: false, googleEmail: null }),
  ]);

  return (
    <>
      <PageHeader title={dict.meetings.title} description={dict.meetings.subtitle} />

      {!connection.connected ? (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm text-amber-800">{dict.meetings.notConnectedWarning}</p>
          </div>
        </Card>
      ) : null}

      <div className="mb-4 flex justify-end">
        <MeetingRequestForm clientId={actor.client.id} defaultEmail={actor.client.email ?? undefined} locale={locale} />
      </div>

      <MeetingRequestsList meetings={meetings} currentSide="client" locale={locale} />
    </>
  );
}
