-- =============================================================================
-- Pix automatico vira marketplace: cada profissional conecta a PROPRIA conta
-- Mercado Pago via OAuth (mesmo espirito da Stripe Connect e do Calendly), em
-- vez de todo Pix cair numa conta unica da agencia. O dinheiro passa a cair
-- direto na conta do profissional responsavel pelo cliente, e a plataforma
-- retem uma comissao via `application_fee` (mesmo percentual e mesma coluna
-- `application_fee_cents` ja usados pela Stripe -- um so lugar para somar
-- comissao coletada, venha ela de qual meio de pagamento for).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Conta Mercado Pago do profissional
-- ----------------------------------------------------------------------------
-- Sem policy nenhuma de proposito, mesmo padrao de `professional_calendly_accounts`:
-- guarda token de OAuth, so a serviceRole mexe aqui.
create table public.professional_mercadopago_accounts (
  user_id uuid primary key references public.users (id) on delete cascade,
  mercadopago_user_id bigint not null,
  public_key text,
  live_mode boolean not null default false,

  access_token text not null,
  refresh_token text not null,
  -- access_token do Mercado Pago dura 180 dias; refresh_token renova sem
  -- precisar o profissional autorizar de novo. Guardamos a expiracao para
  -- renovar de forma preguicosa (so quando estiver perto de vencer), nao a
  -- cada uso.
  token_expires_at timestamptz not null,
  connected_at timestamptz not null default now()
);

alter table public.professional_mercadopago_accounts enable row level security;

-- ----------------------------------------------------------------------------
-- Snapshot de qual conta conectada recebe cada cobranca -- mesmo desenho do
-- `stripe_account_id`: gravado na criacao, nunca resolvido de novo pelo
-- `clients.professional_id` na hora de cobrar (se o cliente trocar de
-- responsavel depois, a cobranca ja emitida continua liquidando em quem a
-- emitiu).
-- ----------------------------------------------------------------------------
alter table public.invoices
  add column mercadopago_professional_id uuid references public.users (id);
