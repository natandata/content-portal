-- =============================================================================
-- Content Portal — schema inicial
-- =============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'professional', 'client');
create type public.user_status as enum ('active', 'inactive');
create type public.client_status as enum ('active', 'inactive');
create type public.contract_status as enum (
  'awaiting_signature', 'signed', 'under_review', 'approved', 'replaced'
);
create type public.content_type as enum ('image', 'video', 'carousel');
create type public.content_status as enum (
  'draft', 'submitted', 'awaiting_approval', 'approved',
  'revision_requested', 'rejected', 'published'
);
create type public.approval_status as enum ('approved', 'rejected', 'revision_requested');

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null,
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text not null,
  email text,
  phone text,
  access_code text not null unique
    constraint clients_access_code_format check (access_code ~ '^[A-Z]{3}[0-9]{4}$'),
  professional_id uuid references public.users (id) on delete set null,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  status public.client_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Segredo usado pelo servidor para trocar o codigo de acesso por uma sessao
-- Supabase real. Sem policies: acessivel apenas pela service role.
create table public.client_credentials (
  client_id uuid primary key references public.clients (id) on delete cascade,
  auth_email text not null,
  auth_password text not null,
  created_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  notes text,
  original_file_path text,
  signed_file_path text,
  status public.contract_status not null default 'awaiting_signature',
  created_by uuid references public.users (id) on delete set null,
  uploaded_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  professional_id uuid references public.users (id) on delete set null,
  title text not null,
  description text,
  type public.content_type not null,
  status public.content_status not null default 'draft',
  scheduled_date date,
  caption text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_files (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  file_path text not null,
  thumbnail_path text,
  position smallint not null
    constraint content_files_position_range check (position between 1 and 10),
  file_type text not null,
  created_at timestamptz not null default now(),
  unique (content_id, position)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  status public.approval_status not null,
  comment text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.approval_history (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  actor_name text,
  action text not null,
  comment text,
  created_at timestamptz not null default now()
);

create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  position smallint not null
    constraint feed_items_position_range check (position between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, content_id),
  constraint feed_items_unique_position unique (client_id, position) deferrable initially deferred
);

-- ----------------------------------------------------------------------------
-- Indices
-- ----------------------------------------------------------------------------
create index clients_professional_id_idx on public.clients (professional_id);
create index clients_status_idx on public.clients (status);
create index contracts_client_id_idx on public.contracts (client_id);
create index contracts_status_idx on public.contracts (status);
create index contents_client_id_idx on public.contents (client_id);
create index contents_status_idx on public.contents (status);
create index contents_updated_at_idx on public.contents (updated_at desc);
create index content_files_content_id_idx on public.content_files (content_id, position);
create index approvals_content_id_idx on public.approvals (content_id, created_at desc);
create index approval_history_content_id_idx on public.approval_history (content_id, created_at desc);
create index feed_items_client_id_idx on public.feed_items (client_id, position);

-- ----------------------------------------------------------------------------
-- updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger contracts_set_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();
create trigger contents_set_updated_at before update on public.contents
  for each row execute function public.set_updated_at();
create trigger feed_items_set_updated_at before update on public.feed_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Regras de negocio
-- ----------------------------------------------------------------------------

-- Imagem/video: 1 arquivo. Carrossel: ate 10.
create or replace function public.enforce_content_file_limits()
returns trigger
language plpgsql
as $fn$
declare
  v_type public.content_type;
  v_count integer;
  v_max integer;
begin
  select type into v_type from public.contents where id = new.content_id;
  if v_type is null then
    raise exception 'Conteudo % nao encontrado', new.content_id;
  end if;

  v_max := case when v_type = 'carousel' then 10 else 1 end;

  select count(*) into v_count
  from public.content_files
  where content_id = new.content_id;

  if v_count > v_max then
    raise exception 'Limite de % arquivo(s) atingido para conteudo do tipo %', v_max, v_type
      using errcode = 'check_violation';
  end if;

  if v_type <> 'carousel' and new.position <> 1 then
    raise exception 'Conteudo do tipo % aceita apenas position = 1', v_type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

-- AFTER ROW: so apos o fim do comando a contagem enxerga todas as linhas
-- inseridas por um mesmo INSERT com varios valores.
create trigger content_files_enforce_limits
  after insert or update of content_id, position on public.content_files
  for each row execute function public.enforce_content_file_limits();

-- Feed: no maximo 30 itens por cliente.
create or replace function public.enforce_feed_limit()
returns trigger
language plpgsql
as $fn$
declare
  v_count integer;
begin
  select count(*) into v_count from public.feed_items where client_id = new.client_id;
  if v_count > 30 then
    raise exception 'O feed comporta no maximo 30 conteudos'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger feed_items_enforce_limit
  after insert on public.feed_items
  for each row execute function public.enforce_feed_limit();

-- Geracao de codigo de acesso: 3 letras + 4 numeros, unico.
create or replace function public.generate_access_code(p_seed text default null)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  v_letters text;
  v_code text;
  v_attempt integer := 0;
begin
  v_letters := upper(regexp_replace(coalesce(p_seed, ''), '[^A-Za-z]', '', 'g'));

  loop
    v_attempt := v_attempt + 1;

    if length(v_letters) >= 3 and v_attempt <= 20 then
      v_code := substr(v_letters, 1, 3);
    else
      v_code := chr(65 + floor(random() * 26)::int)
             || chr(65 + floor(random() * 26)::int)
             || chr(65 + floor(random() * 26)::int);
    end if;

    v_code := v_code || lpad(floor(random() * 10000)::int::text, 4, '0');

    exit when not exists (select 1 from public.clients where access_code = v_code);

    if v_attempt > 200 then
      raise exception 'Nao foi possivel gerar um codigo de acesso unico';
    end if;
  end loop;

  return v_code;
end;
$fn$;
