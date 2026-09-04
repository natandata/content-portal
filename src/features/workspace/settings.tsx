import Link from "next/link";
import { CreditCard } from "lucide-react";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { PlatformFeeForm } from "@/components/professionals/platform-fee-form";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/layout";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { requireStaff } from "@/lib/auth";
import { formatMoney, ROLE_LABEL } from "@/lib/domain";
import { DEFAULT_PLATFORM_FEE_PERCENT } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export async function WorkspaceSettings() {
  const actor = await requireStaff();

  // So o admin mexe na comissao — busca so entra nesse papel.
  const platformFeeData =
    actor.role === "admin" ? await loadPlatformFeeOverview() : null;

  return (
    <>
      <PageHeader
        title="Configuracoes"
        description="Dados da sua conta, aparencia e seguranca."
      />

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

        {/* So o profissional recebe: e a conta bancaria dele que entra no
            cadastro da Stripe. */}
        {actor.role === "professional" ? (
          <Card>
            <CardHeader
              title="Receber pagamento online"
              description="Conecte sua conta Stripe para o cliente pagar a cobranca dentro do portal."
            />
            <Link
              href="/professional/settings/payments"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
            >
              <CreditCard className="size-4" aria-hidden />
              Abrir configuracao de pagamento
            </Link>
          </Card>
        ) : null}

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
            description="Avisos de conteudo, documentos e retorno do cliente neste aparelho."
          />
          <NotificationSettings />
        </Card>

        <Card>
          <CardHeader
            title="Alterar senha"
            description="Recomendado logo no primeiro acesso."
          />
          <ChangePasswordForm />
        </Card>
      </div>

      {platformFeeData ? (
        <Card className="mt-5">
          <CardHeader
            title="Pagamento online — comissao da plataforma"
            description="Quanto ja foi retido em cobrancas pagas pela Stripe, e o percentual de cada profissional (0 a 100%)."
          />

          <StatCard
            label="Taxa coletada"
            value={formatMoney(platformFeeData.totalFeeCents / 100, "BRL")}
            hint="Soma da comissao em todas as cobrancas online ja pagas"
            tone="success"
          />

          <div className="mt-5 flex flex-col divide-y divide-line">
            {platformFeeData.professionals.length === 0 ? (
              <p className="py-3 text-sm text-ink-500">Nenhum profissional cadastrado ainda.</p>
            ) : (
              platformFeeData.professionals.map((professional) => (
                <div key={professional.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{professional.name}</p>
                    <p className="truncate text-xs text-ink-500">{professional.email}</p>
                  </div>
                  <div className="sm:w-48">
                    <PlatformFeeForm userId={professional.id} current={professional.feePercent} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}
    </>
  );
}

/**
 * Total ja retido em comissao (cobrancas online pagas) e o percentual atual
 * de cada profissional. `professional_payment_accounts` so tem linha depois
 * que o profissional conecta a Stripe — sem linha, vale o default da coluna.
 */
async function loadPlatformFeeOverview() {
  const supabase = await createClient();

  const [{ data: professionals }, { data: accounts }, { data: paidFees }] = await Promise.all([
    supabase.from("users").select("id, name, email").eq("role", "professional").order("name"),
    supabase.from("professional_payment_accounts").select("user_id, platform_fee_percent"),
    supabase
      .from("invoices")
      .select("application_fee_cents")
      .eq("status", "paid")
      .not("application_fee_cents", "is", null),
  ]);

  const feeByUserId = new Map(
    (accounts ?? []).map((account) => [account.user_id, Number(account.platform_fee_percent)]),
  );

  const totalFeeCents = (paidFees ?? []).reduce((sum, row) => sum + (row.application_fee_cents ?? 0), 0);

  return {
    totalFeeCents,
    professionals: (professionals ?? []).map((professional) => ({
      id: professional.id,
      name: professional.name,
      email: professional.email,
      feePercent: feeByUserId.get(professional.id) ?? DEFAULT_PLATFORM_FEE_PERCENT,
    })),
  };
}
