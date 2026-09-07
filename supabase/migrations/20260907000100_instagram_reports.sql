-- =============================================================================
-- Relatorios de Instagram via Apify (perfil publico, sem login) e Composio
-- (insights autenticados, via OAuth real do cliente -- nunca usuario/senha).
-- =============================================================================

-- Relatorio 1: scrape de um @ qualquer (do cliente ou de um concorrente), sem
-- login nenhum. Assincrono: a server action cria a linha 'pending' e dispara
-- o run da Apify; o webhook confirma e preenche summary/posts. RLS so de
-- leitura -- quem escreve e sempre `createAdminClient()` (server action e
-- webhook), nunca o cliente autenticado direto.
create table public.instagram_public_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  username text not null check (char_length(btrim(username)) between 1 and 60),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  apify_run_id text,
  apify_dataset_id text,
  -- Dados de perfil (seguidores, bio, etc.) e a lista de posts recentes,
  -- brutos como a Apify devolve -- ver Etapa 2 do plano para os campos.
  summary jsonb,
  posts jsonb,
  requested_by uuid references public.users (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index instagram_public_reports_client_id_idx on public.instagram_public_reports (client_id);

alter table public.instagram_public_reports enable row level security;

create policy "instagram_public_reports_select_scoped" on public.instagram_public_reports
  for select to authenticated
  using (public.can_view_client(client_id));

-- Sem policy de insert/update/delete de proposito -- so a serviceRole grava
-- (server action que dispara o run, e o webhook que confirma o resultado).

-- Conexao OAuth do Instagram Business/Creator do CLIENTE (nao do profissional
-- -- e a conta dele que gera os insights). Sem policy nenhuma de proposito,
-- mesmo padrao de `professional_google_accounts`/`professional_calendly_accounts`:
-- guarda so a referencia da conexao na Composio, nunca um token de acesso --
-- quem guarda e renova o token e a propria Composio.
create table public.client_instagram_connections (
  client_id uuid primary key references public.clients (id) on delete cascade,
  composio_connection_id text not null,
  instagram_username text,
  connected_at timestamptz not null default now()
);

alter table public.client_instagram_connections enable row level security;

-- Relatorio 2: insights autenticados (alcance, engajamento, curtidas/
-- comentarios por post) nos ultimos 3/6/9 meses, via Composio. Mesma RLS de
-- `instagram_public_reports` -- so leitura para quem gerencia o cliente,
-- escrita so pela serviceRole.
create table public.instagram_insights_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period_months integer not null check (period_months in (3, 6, 9)),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  -- Metricas de conta (reach, accounts_engaged, total_interactions, etc.) e
  -- a lista de posts com metricas por item -- ver Etapa 4 do plano.
  account_metrics jsonb,
  posts jsonb,
  requested_by uuid references public.users (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index instagram_insights_reports_client_id_idx on public.instagram_insights_reports (client_id);

alter table public.instagram_insights_reports enable row level security;

create policy "instagram_insights_reports_select_scoped" on public.instagram_insights_reports
  for select to authenticated
  using (public.can_view_client(client_id));
