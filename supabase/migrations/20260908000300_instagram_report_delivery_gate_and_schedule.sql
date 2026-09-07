-- =============================================================================
-- (1) Documento gerado (relatorio) nao fica visivel pro cliente
--     automaticamente -- fica "aguardando envio" ate o profissional liberar.
-- (2) Agendamento avulso de emissao de relatorio por data (alem do
--     automatico mensal ja existente).
-- =============================================================================

-- Todo documento hoje nasce visivel (upload manual sempre foi assim); so o
-- relatorio automatico/gerado passa a nascer com isto em false.
alter table public.contracts
  add column if not exists client_visible boolean not null default true;

-- Status novo -- o profissional gerou o relatorio, mas ainda nao decidiu
-- mandar pro cliente. Nao reaproveita 'awaiting_signature' (implica
-- assinatura pendente, que reports nunca pedem).
alter type public.contract_status add value if not exists 'pending_delivery';

-- Agendamento avulso: "gerar este relatorio neste dia", independente do
-- toggle mensal recorrente de client_instagram_report_settings. So por
-- data -- sem hora, o cron do Hobby roda 1x/dia num horario que a propria
-- Vercel escolhe, entao hora exata nunca seria cumprida.
create table public.instagram_scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  connection_id uuid not null references public.client_instagram_connections (id) on delete cascade,
  period_months integer not null check (period_months in (3, 6, 9)),
  scheduled_date date not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  requested_by uuid references public.users (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index instagram_scheduled_reports_due_idx
  on public.instagram_scheduled_reports (scheduled_date)
  where status = 'pending';

alter table public.instagram_scheduled_reports enable row level security;

create policy "instagram_scheduled_reports_select" on public.instagram_scheduled_reports
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "instagram_scheduled_reports_insert" on public.instagram_scheduled_reports
  for insert to authenticated
  with check (public.can_manage_client(client_id));

-- "Cancelar agendamento" e so um delete de uma linha ainda pendente.
create policy "instagram_scheduled_reports_delete" on public.instagram_scheduled_reports
  for delete to authenticated
  using (public.can_manage_client(client_id));
