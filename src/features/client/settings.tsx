import { NotificationSettings } from "@/components/notifications/notification-settings";
import { Card, CardHeader, PageHeader } from "@/components/ui/layout";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { requireClientActor } from "@/lib/auth";

export async function ClientSettings() {
  await requireClientActor();

  return (
    <>
      <PageHeader title="Configuracoes" description="Aparencia e notificacoes deste aparelho." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Aparencia"
            description="Vale para este aparelho. Em 'Sistema' o app segue o tema do celular ou do computador."
          />
          <ThemeToggle />
        </Card>

        <Card>
          <CardHeader
            title="Notificacoes"
            description="Avisos de novo conteudo, documentos e retorno da equipe."
          />
          <NotificationSettings />
        </Card>
      </div>
    </>
  );
}
