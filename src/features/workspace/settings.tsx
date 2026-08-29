import { ChangePasswordForm } from "@/components/account/change-password-form";
import { Card, CardHeader, PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/domain";

export async function WorkspaceSettings() {
  const actor = await requireStaff();

  return (
    <>
      <PageHeader title="Configuracoes" description="Dados da sua conta e seguranca." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Conta" />
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-ink-500">Nome</dt>
              <dd className="text-ink-900">{actor.displayName}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Email de acesso</dt>
              <dd className="break-all text-ink-900">{actor.authUser.email}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Perfil</dt>
              <dd className="text-ink-900">{ROLE_LABEL[actor.role]}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Alterar senha"
            description="Recomendado logo no primeiro acesso."
          />
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
