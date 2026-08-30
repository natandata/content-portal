import { NotificationSettings } from "@/components/notifications/notification-settings";
import { Card, CardHeader, PageHeader } from "@/components/ui/layout";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";

export async function ClientSettings() {
  await requireClientActor();
  const { locale, dict } = await getServerDictionary();

  return (
    <>
      <PageHeader title={dict.settings.title} description={dict.settings.subtitle} />

      <div className="grid gap-5 lg:grid-cols-2">
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
