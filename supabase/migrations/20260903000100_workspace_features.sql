-- =============================================================================
-- Reorganizacao do menu do profissional: 4 telas novas.
--
-- - Tarefas: lista pessoal do profissional (opcionalmente ligada a um
--   cliente), com status e prazo.
-- - Calendario: reaproveita "contents" (que ja tem scheduled_date, status e
--   aprovacao) — so adiciona hora do post.
-- - Banco de ideias: anotacoes com links (jsonb) e imagens (bucket dedicado).
-- - Relatorios: metricas do cliente lancadas a mao por periodo; futuramente
--   um botao pode preencher isso automaticamente.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Calendario: hora do post, junto da data que "contents" ja guarda.
-- ----------------------------------------------------------------------------
alter table public.contents add column scheduled_time time;

-- ----------------------------------------------------------------------------
-- Tarefas
-- ----------------------------------------------------------------------------
create type public.task_status as enum ('pending', 'in_progress', 'done');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text,
  status public.task_status not null default 'pending',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_professional_id_idx on public.tasks (professional_id);
create index tasks_client_id_idx on public.tasks (client_id);
create index tasks_status_idx on public.tasks (status);

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- So o profissional dono da tarefa (ou admin) enxerga e mexe nela — nao e
-- algo que o cliente ve, entao nao usa can_view_client/can_manage_client.
create policy "tasks_select_owner" on public.tasks
  for select to authenticated
  using (public.is_admin() or professional_id = auth.uid());

create policy "tasks_insert_owner" on public.tasks
  for insert to authenticated
  with check (public.is_admin() or professional_id = auth.uid());

create policy "tasks_update_owner" on public.tasks
  for update to authenticated
  using (public.is_admin() or professional_id = auth.uid())
  with check (public.is_admin() or professional_id = auth.uid());

create policy "tasks_delete_owner" on public.tasks
  for delete to authenticated
  using (public.is_admin() or professional_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Banco de ideias
-- ----------------------------------------------------------------------------
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  notes text,
  -- [{ "label": "Reels concorrente", "url": "https://..." }, ...]
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ideas_professional_id_idx on public.ideas (professional_id);

create trigger ideas_set_updated_at before update on public.ideas
  for each row execute function public.set_updated_at();

alter table public.ideas enable row level security;

create policy "ideas_select_owner" on public.ideas
  for select to authenticated
  using (public.is_admin() or professional_id = auth.uid());

create policy "ideas_insert_owner" on public.ideas
  for insert to authenticated
  with check (public.is_admin() or professional_id = auth.uid());

create policy "ideas_update_owner" on public.ideas
  for update to authenticated
  using (public.is_admin() or professional_id = auth.uid())
  with check (public.is_admin() or professional_id = auth.uid());

create policy "ideas_delete_owner" on public.ideas
  for delete to authenticated
  using (public.is_admin() or professional_id = auth.uid());

-- Imagens anexadas a uma ideia — tabela separada pra permitir varias por
-- ideia, igual content_files faz com contents.
create table public.idea_images (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  file_path text not null,
  created_at timestamptz not null default now()
);

create index idea_images_idea_id_idx on public.idea_images (idea_id);

alter table public.idea_images enable row level security;

create policy "idea_images_select_owner" on public.idea_images
  for select to authenticated
  using (
    exists (
      select 1 from public.ideas i
      where i.id = idea_id and (public.is_admin() or i.professional_id = auth.uid())
    )
  );

create policy "idea_images_insert_owner" on public.idea_images
  for insert to authenticated
  with check (
    exists (
      select 1 from public.ideas i
      where i.id = idea_id and (public.is_admin() or i.professional_id = auth.uid())
    )
  );

create policy "idea_images_delete_owner" on public.idea_images
  for delete to authenticated
  using (
    exists (
      select 1 from public.ideas i
      where i.id = idea_id and (public.is_admin() or i.professional_id = auth.uid())
    )
  );

-- Bucket "ideas": caminho {professional_id}/{idea_id}/{filename}, na mesma
-- convencao dos outros buckets privados do app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ideas', 'ideas', false, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "ideas_storage_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ideas'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy "ideas_storage_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ideas'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy "ideas_storage_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ideas'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ----------------------------------------------------------------------------
-- Relatorios: metricas do cliente lancadas por periodo.
-- ----------------------------------------------------------------------------
create table public.client_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  -- Ex.: "Seguidores", "Alcance", "Engajamento (%)", "Leads".
  metric_name text not null check (char_length(btrim(metric_name)) between 1 and 120),
  metric_value numeric not null,
  -- Mes de referencia da metrica (dia sempre 1) — agrupa o historico.
  period_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_metrics_client_id_idx on public.client_metrics (client_id);
create index client_metrics_period_idx on public.client_metrics (period_date);

create trigger client_metrics_set_updated_at before update on public.client_metrics
  for each row execute function public.set_updated_at();

alter table public.client_metrics enable row level security;

create policy "client_metrics_select_scoped" on public.client_metrics
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "client_metrics_insert_staff" on public.client_metrics
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "client_metrics_update_staff" on public.client_metrics
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "client_metrics_delete_staff" on public.client_metrics
  for delete to authenticated
  using (public.can_manage_client(client_id));

revoke execute on all functions in schema public from anon;
