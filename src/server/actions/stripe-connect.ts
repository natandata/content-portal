"use server";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { z } from "zod";

import { requireAdmin, requireStaff } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import { MAX_PLATFORM_FEE_PERCENT } from "@/lib/money";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";

const SETTINGS_PATH = "/professional/settings/payments";
const STRIPE_OFF = "Pagamento online ainda nao esta configurado nesta instalacao.";

/** Capacidades pedidas no cadastro. Pix costuma ficar inativo no Brasil (e por
 * convite) — pedir mesmo assim nao quebra a criacao da conta. */
const REQUESTED_CAPABILITIES = {
  card_payments: { requested: true },
  transfers: { requested: true },
  boleto_payments: { requested: true },
  pix_payments: { requested: true },
} as const;

/** Achata `account.capabilities` para o formato que guardamos em jsonb. */
function capabilitiesOf(account: Stripe.Account): Record<string, string> {
  const raw = account.capabilities ?? {};
  return Object.fromEntries(
    Object.entries(raw).filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;
}

/** Campos que so a Stripe conhece. Nunca sao digitados por gente. */
function syncPayload(account: Stripe.Account) {
  return {
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    requirements_disabled_reason: account.requirements?.disabled_reason ?? null,
    capabilities: capabilitiesOf(account),
    account_synced_at: new Date().toISOString(),
  };
}

/**
 * Cria (na primeira vez) a conta Express do profissional e devolve o link do
 * cadastro hospedado pela Stripe.
 *
 * Devolve a URL em vez de chamar `redirect()` para manter o contrato
 * ActionResult do resto das acoes — assim o botao consegue mostrar um toast de
 * erro quando a Stripe esta fora, em vez de estourar uma excecao de redirect
 * que o chamador nao tem como tratar.
 */
export async function startConnectOnboardingAction(): Promise<ActionResult<{ url: string }>> {
  const actor = await requireStaff();

  // O dinheiro cai na conta bancaria de quem atende o cliente. Admin nao
  // atende cliente diretamente, entao nao tem conta Connect propria.
  if (actor.role !== "professional") {
    return fail("Apenas profissionais recebem pagamento online.");
  }

  const stripe = getStripe();
  if (!stripe) return fail(STRIPE_OFF);

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: existing } = await supabase
    .from("professional_payment_accounts")
    .select("*")
    .eq("user_id", actor.authUser.id)
    .maybeSingle();

  let accountId = existing?.stripe_account_id ?? null;

  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        country: "BR",
        email: actor.authUser.email ?? undefined,
        capabilities: REQUESTED_CAPABILITIES,
        business_profile: { name: actor.displayName },
        metadata: { app_user_id: actor.authUser.id },
      });
      accountId = account.id;
    } catch (error) {
      return fail(describeError(error as Error, "Nao foi possivel criar a conta na Stripe."));
    }

    const { error } = await admin.from("professional_payment_accounts").upsert(
      {
        user_id: actor.authUser.id,
        stripe_account_id: accountId,
        onboarding_started_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return fail(describeError(error, "Nao foi possivel salvar a conta de pagamento."));
    }
  }

  try {
    // Account Links sao de uso unico e expiram rapido: sempre gerar uma nova,
    // nunca guardar a URL.
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${appBaseUrl()}${SETTINGS_PATH}?refresh=1`,
      return_url: `${appBaseUrl()}${SETTINGS_PATH}?done=1`,
    });

    return ok({ url: link.url });
  } catch (error) {
    return fail(describeError(error as Error, "Nao foi possivel abrir o cadastro da Stripe."));
  }
}

/**
 * Puxa o estado atual da conta na Stripe. O webhook `account.updated` mantem
 * isso em dia sozinho; esta acao existe para o retorno do cadastro (a Stripe
 * nao garante que voltar pela `return_url` signifique cadastro concluido) e
 * para o botao "Atualizar status".
 */
export async function refreshConnectStatusAction(): Promise<ActionResult<null>> {
  const actor = await requireStaff();

  const stripe = getStripe();
  if (!stripe) return fail(STRIPE_OFF);

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("professional_payment_accounts")
    .select("stripe_account_id")
    .eq("user_id", actor.authUser.id)
    .maybeSingle();

  if (!row?.stripe_account_id) return fail("Nenhuma conta Stripe conectada.");

  try {
    const account = await stripe.accounts.retrieve(row.stripe_account_id);
    const admin = createAdminClient();

    const { error } = await admin
      .from("professional_payment_accounts")
      .update(syncPayload(account))
      .eq("user_id", actor.authUser.id);

    if (error) {
      return fail(describeError(error, "Nao foi possivel salvar o status da conta."));
    }
  } catch (error) {
    return fail(describeError(error as Error, "Nao foi possivel consultar a Stripe."));
  }

  revalidatePath(SETTINGS_PATH);
  return done();
}

/** Abre o painel Express, onde o profissional ve saldo e repasses. */
export async function openConnectDashboardAction(): Promise<ActionResult<{ url: string }>> {
  const actor = await requireStaff();

  const stripe = getStripe();
  if (!stripe) return fail(STRIPE_OFF);

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("professional_payment_accounts")
    .select("stripe_account_id, details_submitted")
    .eq("user_id", actor.authUser.id)
    .maybeSingle();

  if (!row?.stripe_account_id) return fail("Nenhuma conta Stripe conectada.");
  if (!row.details_submitted) return fail("Conclua o cadastro na Stripe primeiro.");

  try {
    const link = await stripe.accounts.createLoginLink(row.stripe_account_id);
    return ok({ url: link.url });
  } catch (error) {
    return fail(describeError(error as Error, "Nao foi possivel abrir o painel da Stripe."));
  }
}

const feeSchema = z.object({
  userId: z.uuid(),
  // O teto e trava de dedo gordo, nao regra de negocio.
  percent: z.coerce
    .number()
    .min(0, "A comissao nao pode ser negativa")
    .max(MAX_PLATFORM_FEE_PERCENT, `A comissao maxima e ${MAX_PLATFORM_FEE_PERCENT}%`),
});

/** Comissao que a plataforma retem das cobrancas deste profissional. */
export async function setPlatformFeeAction(
  input: z.input<typeof feeSchema>,
): Promise<ActionResult<null>> {
  await requireAdmin();

  const parsed = feeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  // A tabela nao tem policy de escrita de proposito — nem para admin.
  const admin = createAdminClient();
  const { error } = await admin.from("professional_payment_accounts").upsert(
    { user_id: parsed.data.userId, platform_fee_percent: parsed.data.percent },
    { onConflict: "user_id" },
  );

  if (error) {
    return fail(describeError(error, "Nao foi possivel salvar a comissao."));
  }

  revalidatePath("/admin/professionals");
  revalidatePath(`/admin/professionals/${parsed.data.userId}`);
  return done();
}
