-- =============================================================================
-- Reunioes com Google Meet
--
-- Cada profissional conecta a PROPRIA conta Google (mesmo espirito da Stripe
-- Connect): a reuniao nasce na agenda real dele, com o cliente convidado por
-- e-mail -- o cliente nunca precisa de conta Google.
-- =============================================================================

-- Sem policy nenhuma de proposito, mesmo padrao de `client_credentials` e
-- `stripe_events`: guarda token de OAuth, so a serviceRole mexe aqui.
create table if not exists public.professional_google_accounts (
  user_id uuid primary key references public.users (id) on delete cascade,
  google_email text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  calendar_id text not null default 'primary',
  connected_at timestamptz not null default now()
);

alter table public.professional_google_accounts enable row level security;

create table if not exists public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  professional_id uuid not null references public.users (id) on delete cascade,

  requested_by text not null check (requested_by in ('client', 'professional')),
  -- E-mail informado por quem pediu, para garantir que sempre exista um
  -- endereco valido para convidar -- `clients.email` pode estar vazio.
  contact_email text not null,
  proposed_date date not null,
  proposed_time time not null,
  message text,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'cancelled')),
  responded_at timestamptz,

  google_event_id text,
  meet_link text,

  -- auth.users, nao public.users: quem pede pode ser cliente, e cliente nao
  -- tem linha em public.users (so em clients.auth_user_id).
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_requests_client_idx on public.meeting_requests (client_id, created_at desc);
create index if not exists meeting_requests_professional_idx on public.meeting_requests (professional_id, status);

create trigger meeting_requests_set_updated_at
  before update on public.meeting_requests
  for each row execute function public.set_updated_at();

alter table public.meeting_requests enable row level security;

-- As duas partes envolvidas (e o admin) leem o pedido inteiro. Escrita fica
-- so com as server actions via serviceRole: aprovar dispara a chamada real
-- na API do Google, e quem pode aprovar e sempre "quem NAO pediu" -- regra
-- facil demais de furar numa policy de SQL, mais segura sendo checada no
-- codigo antes de usar o client admin.
create policy "meeting_requests_select" on public.meeting_requests
  for select to authenticated
  using (public.can_view_client(client_id));
