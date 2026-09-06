-- =============================================================================
-- Reunioes via Calendly — convive com o Google Meet, nao substitui.
--
-- Cada profissional conecta a PROPRIA conta Calendly (mesmo espirito da
-- Stripe Connect e do Google Meet). Em vez de propor uma data as cegas e
-- esperar aprovacao, o app gera um link de agendamento de uso unico contra a
-- disponibilidade REAL do profissional — quem recebe o link escolhe um
-- horario livre e a Calendly confirma sozinha, sem etapa de aprovacao no app.
-- =============================================================================

-- Sem policy nenhuma de proposito, mesmo padrao de `professional_google_accounts`
-- e `client_credentials`: guarda token de OAuth, so a serviceRole mexe aqui.
create table if not exists public.professional_calendly_accounts (
  user_id uuid primary key references public.users (id) on delete cascade,
  calendly_uri text not null,
  calendly_email text not null,
  scheduling_url text not null,
  organization_uri text,

  -- Nulos ate o profissional escolher, na tela de configuracoes, qual dos
  -- Event Types que ja existem na conta dele usar para reuniao do portal.
  event_type_uri text,
  event_type_name text,
  event_type_scheduling_url text,
  event_type_duration integer,

  -- Para apagar a assinatura de webhook quando o profissional desconectar, e
  -- para verificar a assinatura HMAC de cada entrega (cada subscription tem
  -- a propria signing_key — nao existe uma unica para o app inteiro).
  webhook_subscription_uri text,
  webhook_signing_key text,

  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz,
  connected_at timestamptz not null default now()
);

alter table public.professional_calendly_accounts enable row level security;

-- Mesmo padrao de `stripe_events`: idempotencia por claim-then-process. A
-- chave exata do payload do webhook precisa ser confirmada contra uma
-- entrega real antes de escrever a rota (ver plano) — a coluna comeca
-- generica o bastante para acomodar o que for confirmado.
create table if not exists public.calendly_webhook_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

alter table public.calendly_webhook_events enable row level security;

-- ----------------------------------------------------------------------------
-- meeting_requests passa a suportar os dois metodos
-- ----------------------------------------------------------------------------

alter table public.meeting_requests
  add column if not exists method text not null default 'google_meet'
    check (method in ('google_meet', 'calendly'));

-- proposed_date/proposed_time so fazem sentido no metodo Google (proposta
-- manual de data); no metodo Calendly, o horario so existe depois que a
-- pessoa marca de verdade, e vem em scheduled_start/scheduled_end.
alter table public.meeting_requests alter column proposed_date drop not null;
alter table public.meeting_requests alter column proposed_time drop not null;

alter table public.meeting_requests
  add constraint meeting_requests_google_needs_proposed_time
    check (method <> 'google_meet' or (proposed_date is not null and proposed_time is not null));

alter table public.meeting_requests add column if not exists calendly_booking_url text;
alter table public.meeting_requests add column if not exists calendly_event_uri text;
alter table public.meeting_requests add column if not exists scheduled_start timestamptz;
alter table public.meeting_requests add column if not exists scheduled_end timestamptz;

-- "scheduled" e o status proprio do metodo Calendly quando o webhook
-- confirma a marcacao — nao reaproveita "approved" (que e do fluxo de
-- aprovar/recusar do Google) com um sentido forcado.
alter table public.meeting_requests drop constraint if exists meeting_requests_status_check;
alter table public.meeting_requests
  add constraint meeting_requests_status_check
    check (status in ('pending', 'approved', 'declined', 'cancelled', 'scheduled'));
