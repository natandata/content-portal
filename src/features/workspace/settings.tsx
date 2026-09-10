import Link from "next/link";
import { CreditCard, MessageCircle, Share2, Video } from "lucide-react";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { PlatformFeeForm } from "@/components/professionals/platform-fee-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui/layout";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { basePath, requireStaff } from "@/lib/auth";
import { formatMoney, ROLE_LABEL } from "@/lib/domain";
import {
  anthropicConfig,
  composioConfig,
  focusNfeConfig,
  mercadoPagoConfig,
  socialAuthConfigId,
  twilioConfig,
} from "@/lib/env";
import { DEFAULT_PLATFORM_FEE_PERCENT } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const SOCIAL_PLATFORM_LABEL = {
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  pinterest: "Pinterest",
  youtube: "YouTube",
} as const;

export async function WorkspaceSettings() {
  const actor = await requireStaff();
  const base = basePath(actor.role);

  // So o admin mexe na comissao e ve o status das integracoes da
  // plataforma inteira — busca so entra nesse papel.
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

        {actor.role === "professional" ? (
          <Card>
            <CardHeader
              title="Reunioes por Google Meet"
              description="Conecte sua agenda para o cliente marcar reuniao direto pelo portal."
            />
            <Link
              href="/professional/settings/meetings"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
            >
              <Video className="size-4" aria-hidden />
              Abrir configuracao de reunioes
            </Link>
          </Card>
        ) : null}

        {/* Publicacoes: Instagram + as 5 redes adicionais, para admin e
            profissional (ambos gerenciam clientes e conectam redes). */}
        <Card>
          <CardHeader
            title="Publicacoes"
            description="Conecte Instagram, TikTok, LinkedIn, Facebook, Pinterest e YouTube de cada cliente."
          />
          <Link
            href={`${base}/settings/publications`}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
          >
            <Share2 className="size-4" aria-hidden />
            Abrir conexoes de redes sociais
          </Link>
        </Card>

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

      {actor.role === "admin" ? (
        <Card className="mt-5">
          <CardHeader
            title="Integracoes da plataforma"
            description="Credenciais unicas da agencia (nao por profissional). Configure nas variaveis de ambiente do projeto na Vercel."
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <IntegrationStatusRow label="Instagram" configured={Boolean(composioConfig())} />
            {(Object.keys(SOCIAL_PLATFORM_LABEL) as (keyof typeof SOCIAL_PLATFORM_LABEL)[]).map((platform) => (
              <IntegrationStatusRow
                key={platform}
                label={SOCIAL_PLATFORM_LABEL[platform]}
                configured={Boolean(socialAuthConfigId(platform))}
              />
            ))}
            <IntegrationStatusRow label="Mercado Pago (Pix automatico)" configured={Boolean(mercadoPagoConfig())} />
            <IntegrationStatusRow label="Focus NFe (nota fiscal)" configured={Boolean(focusNfeConfig())} />
            <IntegrationStatusRow label="WhatsApp (Twilio)" configured={Boolean(twilioConfig())} />
            <IntegrationStatusRow label="Legenda por IA" configured={Boolean(anthropicConfig())} />
          </div>
        </Card>
      ) : null}
    </>
  );
}

function IntegrationStatusRow({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-ink-800">
        {label === "WhatsApp (Twilio)" ? <MessageCircle className="size-3.5 text-ink-400" aria-hidden /> : null}
        {label}
      </span>
      <Badge tone={configured ? "success" : "neutral"}>{configured ? "Configurado" : "Nao configurado"}</Badge>
    </div>
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
