-- =============================================================================
-- Perfil do Instagram na simulacao do feed
--
-- A grade 3x10 sozinha nao parece o Instagram. O que faz parecer e o cabecalho:
-- foto, nome, @, bio, destaques e as abas. Tudo isso e editavel pela equipe e
-- so leitura para o cliente.
-- =============================================================================

create table if not exists public.client_profiles (
  client_id uuid primary key references public.clients (id) on delete cascade,
  display_name text,
  username text
    constraint client_profiles_username_format
      check (username is null or username ~ '^[A-Za-z0-9._]{1,30}$'),
  bio text
    constraint client_profiles_bio_length check (bio is null or char_length(bio) <= 300),
  avatar_path text,
  posts_count integer,
  followers_count integer not null default 0
    constraint client_profiles_followers_range check (followers_count >= 0),
  following_count integer not null default 0
    constraint client_profiles_following_range check (following_count >= 0),
  show_reels_tab boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.client_profiles.posts_count is
  'Numero exibido no cabecalho. Nulo = usa a contagem real do feed.';

create table if not exists public.profile_highlights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null
    constraint profile_highlights_title_length
      check (char_length(title) between 1 and 20),
  cover_path text,
  position smallint not null
    constraint profile_highlights_position_range check (position between 1 and 10),
  created_at timestamptz not null default now(),
  unique (client_id, position)
);

create index if not exists profile_highlights_client_id_idx
  on public.profile_highlights (client_id, position);

create trigger client_profiles_set_updated_at before update on public.client_profiles
  for each row execute function public.set_updated_at();

-- No maximo 10 destaques por cliente. AFTER ROW para enxergar todas as linhas
-- de um insert multiplo.
create or replace function public.enforce_highlight_limit()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  select count(*) into v_count from public.profile_highlights where client_id = new.client_id;
  if v_count > 10 then
    raise exception 'O perfil comporta no maximo 10 destaques'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$fn$;

drop trigger if exists profile_highlights_limit on public.profile_highlights;
create trigger profile_highlights_limit
  after insert on public.profile_highlights
  for each row execute function public.enforce_highlight_limit();

-- ---------------------------------------------------------------------------
-- RLS: mesma regra do resto do portal — ve quem ve o cliente, edita quem o
-- gerencia.
-- ---------------------------------------------------------------------------
alter table public.client_profiles enable row level security;
alter table public.profile_highlights enable row level security;

create policy "client_profiles_select" on public.client_profiles
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "client_profiles_insert" on public.client_profiles
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "client_profiles_update" on public.client_profiles
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "client_profiles_delete" on public.client_profiles
  for delete to authenticated
  using (public.can_manage_client(client_id));

create policy "profile_highlights_select" on public.profile_highlights
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "profile_highlights_insert" on public.profile_highlights
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "profile_highlights_update" on public.profile_highlights
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "profile_highlights_delete" on public.profile_highlights
  for delete to authenticated
  using (public.can_manage_client(client_id));

-- ---------------------------------------------------------------------------
-- Storage: foto de perfil e capas dos destaques.
-- Policies proprias em vez de alterar as existentes — aditivo e reversivel.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profiles', 'profiles', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "storage_profiles_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profiles'
    and public.can_view_client(public.storage_client_id(name))
  );

create policy "storage_profiles_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profiles'
    and public.can_manage_client(public.storage_client_id(name))
  );

create policy "storage_profiles_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profiles'
    and public.can_manage_client(public.storage_client_id(name))
  )
  with check (
    bucket_id = 'profiles'
    and public.can_manage_client(public.storage_client_id(name))
  );

create policy "storage_profiles_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profiles'
    and public.can_manage_client(public.storage_client_id(name))
  );

-- Funcao de trigger nao e endpoint: ninguem chama pelo PostgREST.
revoke execute on function public.enforce_highlight_limit() from anon, authenticated;

-- O Supabase concede EXECUTE a anon por padrao; nada novo aqui e publico.
revoke execute on all functions in schema public from anon;
