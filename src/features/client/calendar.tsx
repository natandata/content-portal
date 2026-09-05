import { ClientContentCalendar } from "@/components/calendar/client-content-calendar";
import { PageHeader } from "@/components/ui/layout";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadClientContentCalendar } from "@/server/queries";

export async function ClientCalendar() {
  const actor = await requireClientActor();
  const { locale, dict } = await getServerDictionary();
  const supabase = await createClient();

  const posts = await loadClientContentCalendar(supabase, actor.client.id);

  return (
    <>
      <PageHeader title={dict.postCalendar.title} description={dict.postCalendar.subtitle} />
      <ClientContentCalendar posts={posts} basePath="/client" locale={locale} />
    </>
  );
}
