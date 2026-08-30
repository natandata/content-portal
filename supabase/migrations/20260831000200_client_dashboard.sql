-- =============================================================================
-- Escopo do cliente (Projetos Ativos) e log de atividades (Atividades Recentes)
--
-- client_services: lista curta de servicos combinados com o cliente — nome do
-- servico e o valor, cada um na moeda que fizer sentido (BRL do dia a dia,
-- estrangeira quando o cliente e de fora). So a equipe mantem essa lista.
--
-- client_activities: feed cronologico de acoes relevantes sobre o cliente —
-- aprovacao de conteudo, assinatura de documento, cobranca enviada/paga.
-- Cliente e equipe podem gravar (mesma regra de approval_history: quem ve o
-- cliente pode logar uma acao sobre ele), ninguem edita ou apaga depois.
-- =============================================================================

create table public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency_code not null default 'BRL',
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_services_client_id_idx on public.client_services (client_id, position);

create trigger client_services_set_updated_at before update on public.client_services
  for each row execute function public.set_updated_at();

alter table public.client_services enable row level security;

create policy "client_services_select_scoped" on public.client_services
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "client_services_insert_staff" on public.client_services
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "client_services_update_staff" on public.client_services
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "client_services_delete_staff" on public.client_services
  for delete to authenticated
  using (public.can_manage_client(client_id));

create table public.client_activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  actor_name text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index client_activities_client_id_idx on public.client_activities (client_id, created_at desc);

alter table public.client_activities enable row level security;

create policy "client_activities_select_scoped" on public.client_activities
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "client_activities_insert_scoped" on public.client_activities
  for insert to authenticated
  with check (public.can_view_client(client_id));

revoke execute on all functions in schema public from anon;
