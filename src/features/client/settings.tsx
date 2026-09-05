import { ClientAvatarUpload } from "@/components/clients/client-avatar-upload";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { Card, CardHeader, PageHeader } from "@/components/ui/layout";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { BUCKETS } from "@/lib/paths";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function ClientSettings() {
  const actor = await requireClientActor();
  const { locale, dict } = await getServerDictionary();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("avatar_path")
    .eq("client_id", actor.client.id)
    .maybeSingle();

  const avatarUrl = profile?.avatar_path ? await signedUrl(supabase, BUCKETS.profiles, profile.avatar_path) : null;

  return (
    <>
      <PageHeader title={dict.settings.title} description={dict.settings.subtitle} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={dict.settings.photo} description={dict.settings.photoHint} />
          <ClientAvatarUpload
            clientId={actor.client.id}
            name={actor.client.company_name}
            avatarUrl={avatarUrl}
            locale={locale}
            size="size-20"
          />
        </Card>

        <Card>
          <CardHeader title={dict.settings.appearance} description={dict.settings.appearanceHint} />
          <ThemeToggle locale={locale} />
        </Card>

        <Card>
          <CardHeader title={dict.settings.notifications} description={dict.notifications.settingsHint} />
          <NotificationSettings locale={locale} />
        </Card>
      </div>
    </>
  );
}
