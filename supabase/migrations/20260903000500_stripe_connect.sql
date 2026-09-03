-- =============================================================================
-- Pagamento online das cobrancas via Stripe Connect (contas Express, BR)
--
-- O dinheiro cai direto na conta do profissional responsavel pelo cliente
-- (direct charge: ele e o merchant of record), e a plataforma retem uma
-- comissao percentual definida por profissional.
--
-- Escrita e leitura sao separadas de proposito:
--   - `professional_payment_accounts` so tem policy de SELECT. Toda escrita
--     passa pela serviceRole dentro de acao ja autenticada. Sem isso, uma
--     sessao de profissional poderia zerar a propria comissao — e comissao e
--     dinheiro, entao recebe o mesmo tratamento de um segredo (mesmo padrao de
--     `client_credentials`).
--   - `stripe_events` nao tem policy nenhuma: e tabela de bastidor do webhook.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Conta Stripe do profissional
-- ----------------------------------------------------------------------------
create table public.professional_payment_accounts (
  -- PK e o proprio usuario: um profissional, uma conta Stripe.
  user_id uuid primary key references public.users (id) on delete cascade,
  stripe_account_id text unique,

  -- Espelho do que a Stripe diz. Escrito pelo webhook `account.updated` e pelo
  -- refresh manual; nunca digitado por gente.
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements_disabled_reason text,
  -- {"card_payments":"active","boleto_payments":"pending","pix_payments":"inactive"}
  capabilities jsonb not null default '{}'::jsonb,

  -- Comissao da plataforma sobre cada cobranca paga. O default e a regra de
  -- negocio: profissional novo entra em 1%.
  platform_fee_percent numeric(5, 2) not null default 1.00
    check (platform_fee_percent >= 0 and platform_fee_percent <= 100),

  onboarding_started_at timestamptz,
  account_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger professional_payment_accounts_set_updated_at
  before update on public.professional_payment_accounts
  for each row execute function public.set_updated_at();

alter table public.professional_payment_accounts enable row level security;

-- O profissional ve a propria conta; o admin ve todas (precisa, para editar a
-- comissao). Ninguem escreve por aqui.
create policy "professional_payment_accounts_select_self_or_admin"
  on public.professional_payment_accounts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- Colunas de pagamento online na cobranca
-- ----------------------------------------------------------------------------
alter table public.invoices
  -- Snapshot de qual conta conectada recebe esta cobranca. Gravado na criacao,
  -- e nao resolvido via clients.professional_id na hora de cobrar: se o cliente
  -- trocar de responsavel depois, a cobranca ja emitida continua liquidando na
  -- conta de quem a emitiu.
  add column stripe_account_id text,
  add column stripe_checkout_session_id text,
  add column stripe_payment_intent_id text,
  -- paid | processing | failed — o estado da Stripe, que e mais granular que o
  -- nosso `status`. Boleto e Pix ficam em processing por ate 2 dias uteis.
  add column stripe_payment_status text,
  add column stripe_hosted_url text,
  add column stripe_hosted_url_expires_at timestamptz,
  add column application_fee_cents integer check (application_fee_cents >= 0),
  add column amount_paid_cents integer check (amount_paid_cents >= 0);

-- Mesma forma das constraints de link e pix: inerte para os outros metodos.
alter table public.invoices
  add constraint invoices_stripe_payload_check check (
    method <> 'stripe' or (currency = 'BRL' and stripe_account_id is not null)
  );

-- Unicos e parciais: sao os dois caminhos de busca do webhook, e ficam nulos em
-- toda cobranca manual.
create unique index invoices_stripe_checkout_session_id_idx
  on public.invoices (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index invoices_stripe_payment_intent_id_idx
  on public.invoices (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ----------------------------------------------------------------------------
-- Idempotencia do webhook
-- ----------------------------------------------------------------------------
create table public.stripe_events (
  -- Foge da convencao de uuid de proposito: a PK E a chave de deduplicacao. O
  -- id vem da Stripe (evt_...) e o unique violation e o sinal de "ja processei".
  id text primary key,
  type text not null,
  -- Conta conectada que originou o evento; nulo em evento da plataforma.
  account_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create index stripe_events_type_idx on public.stripe_events (type);
create index stripe_events_received_at_idx on public.stripe_events (received_at);

-- Sem policy: so a serviceRole enxerga. Nenhuma tela le esta tabela.
alter table public.stripe_events enable row level security;
