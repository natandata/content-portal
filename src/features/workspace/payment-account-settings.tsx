import { AlertTriangle, Clock, Info } from "lucide-react";

import {
  ConnectDashboardButton,
  ConnectOnboardingButton,
  ConnectStatusRefresh,
} from "@/components/stripe/connect-onboarding-button";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/layout";
import { requireStaff } from "@/lib/auth";
import { stripeSecretKey } from "@/lib/env";
import { formatFeePercent } from "@/lib/money";
import {
  CAPABILITY_LABEL,
  CAPABILITY_TONE,
  CONNECT_STATUS_LABEL,
  CONNECT_STATUS_TONE,
  METHOD_LABEL,
  STRIPE_METHODS,
  capabilityState,
  connectStatusOf,
} from "@/lib/stripe/capabilities";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { refreshConnectStatusAction } from "@/server/actions/stripe-connect";

/**
 * Tela do profissional para receber pagamento online.
 *
 * Ao voltar do cadastro da Stripe (`?done=1`) puxa o status na hora: a Stripe
 * nao garante que cair na `return_url` signifique cadastro concluido, e o
 * webhook `account.updated` pode demorar alguns segundos.
 */
export async function PaymentAccountSettings({ justReturned }: { justReturned?: boolean }) {
  const actor = await requireStaff();

  if (justReturned) {
    await refreshConnectStatusAction();
  }

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("professional_payment_accounts")
    .select("*")
    .eq("user_id", actor.authUser.id)
    .maybeSingle();

  const status = connectStatusOf(account);
  const configured = Boolean(stripeSecretKey());

  return (
    <>
      <PageHeader
        title="Receber pagamento online"
        description="Conecte sua conta para o cliente pagar a cobranca dentro do portal, com o dinheiro caindo direto na sua conta bancaria."
        actions={
          status !== "not_connected" ? (
            <div className="flex gap-2">
              <ConnectStatusRefresh />
              {status === "active" ? <ConnectDashboardButton /> : null}
            </div>
          ) : undefined
        }
      />

      {!configured ? (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm text-amber-800">
              O pagamento online ainda nao foi configurado nesta instalacao. Fale com o
              administrador antes de tentar conectar sua conta.
            </p>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink-900">Sua conta Stripe</h2>
            <Badge tone={CONNECT_STATUS_TONE[status]}>{CONNECT_STATUS_LABEL[status]}</Badge>
          </div>

          {status === "not_connected" ? (
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-ink-600">
                A Stripe cuida do cadastro: ela pede seus dados, seu CPF ou CNPJ e a conta
                bancaria onde voce quer receber, e faz a verificacao. Leva alguns minutos.
              </p>
              <ConnectOnboardingButton label="Conectar minha conta" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {status === "incomplete" ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">
                    Seu cadastro na Stripe ficou pela metade. Enquanto nao terminar, voce nao
                    consegue receber.
                  </p>
                  <ConnectOnboardingButton label="Continuar cadastro" />
                </div>
              ) : null}

              {status === "restricted" ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-800">
                    A Stripe pausou os recebimentos desta conta
                    {account?.requirements_disabled_reason
                      ? ` (motivo: ${account.requirements_disabled_reason})`
                      : ""}
                    . Normalmente falta enviar algum documento.
                  </p>
                  <ConnectOnboardingButton label="Resolver pendencia" />
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                  Formas de pagamento
                </h3>
                <div className="flex flex-col gap-2">
                  {STRIPE_METHODS.map((method) => {
                    const state = capabilityState(account, method);
                    return (
                      <div
                        key={method}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
                      >
                        <span className="text-sm text-ink-800">{METHOD_LABEL[method]}</span>
                        <Badge tone={CAPABILITY_TONE[state]}>{CAPABILITY_LABEL[state]}</Badge>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 flex gap-1.5 text-xs text-ink-500">
                  <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                  No Brasil a Stripe libera o Pix por convite. Se ele aparecer como nao
                  disponivel, o cartao e o boleto seguem funcionando normalmente.
                </p>
              </div>

              {account?.account_synced_at ? (
                <p className="text-xs text-ink-400">
                  Status consultado em {formatDateTime(account.account_synced_at)}
                </p>
              ) : null}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Clock className="size-4 text-ink-400" aria-hidden />
              Quando o dinheiro chega
            </h2>
            {/* Prazo do cartao surpreende todo mundo: melhor avisar antes da
                primeira venda do que responder a duvida depois. */}
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-600">Pix e boleto</dt>
                <dd className="font-medium text-ink-900">2 dias uteis</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-600">Cartao internacional</dt>
                <dd className="font-medium text-ink-900">5 dias</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-600">Cartao brasileiro</dt>
                <dd className="font-medium text-ink-900">30 dias</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-500">
              Prazo da propria Stripe ate o valor ficar disponivel para saque. Depois disso o
              repasse para sua conta bancaria e diario.
            </p>
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink-900">Comissao da plataforma</h2>
            <p className="text-2xl font-semibold tracking-tight text-ink-900">
              {formatFeePercent(account?.platform_fee_percent ?? 1)}
            </p>
            <p className="mt-2 text-xs text-ink-500">
              Retido de cada cobranca paga, alem da taxa da propria Stripe. Definido pelo
              administrador.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
