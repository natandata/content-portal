-- =============================================================================
-- client_references: "Banco de Referencias" -- lista de links de conteudo de
-- referencia que o profissional cadastra pra o cliente gravar. Mesmo molde de
-- client_services (staff adiciona/remove, cliente so ve), so trocando
-- amount/currency por url. Ver supabase/migrations/20260831000200_client_dashboard.sql.
-- =============================================================================

create table public.client_references (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  url text not null check (char_length(url) between 1 and 2048),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_references_client_id_idx on public.client_references (client_id, position);

create trigger client_references_set_updated_at before update on public.client_references
  for each row execute function public.set_updated_at();

alter table public.client_references enable row level security;

create policy "client_references_select_scoped" on public.client_references
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "client_references_insert_staff" on public.client_references
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "client_references_update_staff" on public.client_references
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "client_references_delete_staff" on public.client_references
  for delete to authenticated
  using (public.can_manage_client(client_id));
