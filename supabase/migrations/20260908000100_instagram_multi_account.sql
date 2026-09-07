-- =============================================================================
-- Instagram: um cliente pode ter mais de uma conta conectada, uma marcada
-- como "principal" (a que entra no relatorio automatico mensal).
-- =============================================================================

-- client_instagram_connections deixa de ter client_id como chave primaria
-- (so permitia uma conexao por cliente) e ganha id proprio + label + flag de
-- principal. Continua sem policy de RLS de proposito -- mesma razao de
-- sempre: guarda so a referencia da conexao na Composio, nunca um token.
alter table public.client_instagram_connections
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists label text check (char_length(label) <= 80),
  add column if not exists is_principal boolean not null default false;

-- Linhas que ja existem (hoje, zero em producao) sao, cada uma, a unica
-- conexao do proprio cliente -- viram principal automaticamente.
update public.client_instagram_connections set is_principal = true;

alter table public.client_instagram_connections drop constraint client_instagram_connections_pkey;
alter table public.client_instagram_connections add primary key (id);

create index client_instagram_connections_client_id_idx
  on public.client_instagram_connections (client_id);

-- So uma principal por cliente -- garantido no banco, nao so na aplicacao.
create unique index client_instagram_connections_one_principal_idx
  on public.client_instagram_connections (client_id)
  where is_principal;

-- Cada relatorio de insights passa a saber de qual conta ele veio. Nullable
-- e "on delete set null" -- remover uma conexao nao apaga o historico.
alter table public.instagram_insights_reports
  add column if not exists connection_id uuid
    references public.client_instagram_connections (id) on delete set null;

create index instagram_insights_reports_connection_id_idx
  on public.instagram_insights_reports (connection_id);

-- Preferencia de relatorio automatico mensal, uma linha por cliente. Mesmo
-- padrao de client_branding: RLS de leitura/gestao via can_view_client/
-- can_manage_client, client_id e a propria chave primaria.
create table public.client_instagram_report_settings (
  client_id uuid primary key references public.clients (id) on delete cascade,
  auto_report_enabled boolean not null default false,
  auto_report_period_months integer not null default 3
    check (auto_report_period_months in (3, 6, 9)),
  -- 'YYYY-MM' -- trava de idempotencia do cron: so gera de novo se o mes mudou.
  last_auto_report_month text,
  updated_at timestamptz not null default now()
);

create trigger client_instagram_report_settings_set_updated_at
  before update on public.client_instagram_report_settings
  for each row execute function public.set_updated_at();

alter table public.client_instagram_report_settings enable row level security;

create policy "client_instagram_report_settings_select" on public.client_instagram_report_settings
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "client_instagram_report_settings_insert" on public.client_instagram_report_settings
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "client_instagram_report_settings_update" on public.client_instagram_report_settings
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));
