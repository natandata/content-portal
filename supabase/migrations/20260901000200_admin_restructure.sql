-- =============================================================================
-- Reestruturacao da area do admin
--
-- 1) Mural ganha uma data prevista de implementacao (scheduled_date).
-- 2) Chat interno passa a existir tambem entre admin e cada profissional —
--    um thread por profissional, no mesmo desenho do chat profissional<->
--    cliente (chat_threads/chat_messages/chat_reads), mas em tabelas
--    proprias porque o participante aqui e um profissional, nao um cliente.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1) Mural: data prevista de implementacao
-- ----------------------------------------------------------------------------
alter table public.bulletin_posts add column if not exists scheduled_date date;

-- O tipo de retorno mudou (nova coluna): precisa dropar antes de recriar.
drop function if exists public.bulletin_feed();
drop function if exists public.bulletin_admin_report();

create or replace function public.bulletin_feed()
returns table (
  id uuid,
  title text,
  body text,
  scheduled_date date,
  created_at timestamptz,
  likes integer,
  dislikes integer,
  my_vote smallint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select
    p.id,
    p.title,
    p.body,
    p.scheduled_date,
    p.created_at,
    coalesce(sum((v.vote = 1)::int), 0)::integer as likes,
    coalesce(sum((v.vote = -1)::int), 0)::integer as dislikes,
    max(v.vote) filter (where v.user_id = auth.uid()) as my_vote
  from public.bulletin_posts p
  left join public.bulletin_votes v on v.post_id = p.id
  where p.published
  group by p.id
  order by p.created_at desc;
$fn$;

grant execute on function public.bulletin_feed() to authenticated;

create or replace function public.bulletin_admin_report()
returns table (
  post_id uuid,
  title text,
  published boolean,
  scheduled_date date,
  created_at timestamptz,
  likes integer,
  dislikes integer,
  voters jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Apenas o administrador ve o relatorio do mural'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.title,
    p.published,
    p.scheduled_date,
    p.created_at,
    coalesce(sum((v.vote = 1)::int), 0)::integer,
    coalesce(sum((v.vote = -1)::int), 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', coalesce(u.name, c.name, 'Alguem'),
          'role', case when c.id is not null then 'client' else coalesce(u.role::text, '?') end,
          'vote', v.vote
        )
        order by v.created_at
      ) filter (where v.user_id is not null),
      '[]'::jsonb
    ) as voters
  from public.bulletin_posts p
  left join public.bulletin_votes v on v.post_id = p.id
  left join public.users u on u.id = v.user_id
  left join public.clients c on c.auth_user_id = v.user_id
  group by p.id
  order by p.created_at desc;
end;
$fn$;

grant execute on function public.bulletin_admin_report() to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Chat interno: admin <-> profissional (um thread por profissional)
-- ----------------------------------------------------------------------------
create table if not exists public.staff_chat_threads (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null unique references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.staff_chat_threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now()
);

create index if not exists staff_chat_messages_thread_id_idx
  on public.staff_chat_messages (thread_id, created_at);

create table if not exists public.staff_chat_reads (
  thread_id uuid not null references public.staff_chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.staff_chat_threads enable row level security;
alter table public.staff_chat_messages enable row level security;
alter table public.staff_chat_reads enable row level security;

-- So o admin e o proprio profissional do thread participam.
create policy "staff_chat_threads_select" on public.staff_chat_threads
  for select to authenticated
  using (public.is_admin() or professional_id = auth.uid());

create policy "staff_chat_messages_select" on public.staff_chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.staff_chat_threads t
      where t.id = thread_id and (public.is_admin() or t.professional_id = auth.uid())
    )
  );

create policy "staff_chat_reads_select" on public.staff_chat_reads
  for select to authenticated
  using (user_id = auth.uid());

create policy "staff_chat_reads_upsert" on public.staff_chat_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.staff_chat_threads t
      where t.id = thread_id and (public.is_admin() or t.professional_id = auth.uid())
    )
  );

create policy "staff_chat_reads_update" on public.staff_chat_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Envio de mensagem. So admin ou o proprio profissional do thread.
-- ---------------------------------------------------------------------------
create or replace function public.send_staff_chat_message(
  p_professional_id uuid,
  p_body text
)
returns public.staff_chat_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_thread_id uuid;
  v_message public.staff_chat_messages;
begin
  if not (public.is_admin() or auth.uid() = p_professional_id) then
    raise exception 'Sem permissao para esta conversa' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.users where id = p_professional_id and role = 'professional'
  ) then
    raise exception 'Profissional nao encontrado' using errcode = 'no_data_found';
  end if;

  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'Mensagem vazia' using errcode = 'check_violation';
  end if;

  insert into public.staff_chat_threads (professional_id)
  values (p_professional_id)
  on conflict (professional_id) do nothing;

  select id into v_thread_id from public.staff_chat_threads where professional_id = p_professional_id;

  insert into public.staff_chat_messages (thread_id, sender_id, body)
  values (v_thread_id, auth.uid(), btrim(p_body))
  returning * into v_message;

  return v_message;
end;
$fn$;

grant execute on function public.send_staff_chat_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Mensagens do thread, com o nome do remetente resolvido.
-- ---------------------------------------------------------------------------
create or replace function public.staff_chat_thread_messages(p_professional_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  is_admin boolean,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not (public.is_admin() or auth.uid() = p_professional_id) then
    raise exception 'Sem permissao para esta conversa' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    m.id,
    m.sender_id,
    coalesce(u.name, 'Alguem'),
    coalesce(u.role = 'admin', false),
    m.body,
    m.created_at
  from public.staff_chat_messages m
  join public.staff_chat_threads t on t.id = m.thread_id
  left join public.users u on u.id = m.sender_id
  where t.professional_id = p_professional_id
  order by m.created_at asc;
end;
$fn$;

grant execute on function public.staff_chat_thread_messages(uuid) to authenticated;

-- Marca como lido ate agora, para o thread daquele profissional.
create or replace function public.mark_staff_chat_read(p_professional_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_thread_id uuid;
begin
  if not (public.is_admin() or auth.uid() = p_professional_id) then
    raise exception 'Sem permissao para esta conversa' using errcode = 'insufficient_privilege';
  end if;

  insert into public.staff_chat_threads (professional_id)
  values (p_professional_id)
  on conflict (professional_id) do nothing;

  select id into v_thread_id from public.staff_chat_threads where professional_id = p_professional_id;

  insert into public.staff_chat_reads (thread_id, user_id, last_read_at)
  values (v_thread_id, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$fn$;

grant execute on function public.mark_staff_chat_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Inbox do admin: um item por profissional ativo, com a ultima mensagem.
-- ---------------------------------------------------------------------------
create or replace function public.staff_chat_inbox()
returns table (
  professional_id uuid,
  professional_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Apenas o administrador ve esta lista' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    u.id,
    u.name,
    last_msg.body,
    last_msg.created_at,
    coalesce(unread.count, 0)::integer
  from public.users u
  left join public.staff_chat_threads t on t.professional_id = u.id
  left join lateral (
    select m.body, m.created_at
    from public.staff_chat_messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) last_msg on true
  left join lateral (
    select count(*) as count
    from public.staff_chat_messages m
    left join public.staff_chat_reads r on r.thread_id = t.id and r.user_id = auth.uid()
    where m.thread_id = t.id
      and m.sender_id <> auth.uid()
      and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  ) unread on true
  where u.role = 'professional' and u.status = 'active'
  order by last_msg.created_at desc nulls last, u.name asc;
end;
$fn$;

grant execute on function public.staff_chat_inbox() to authenticated;

-- ---------------------------------------------------------------------------
-- Nao-lidas totais, para o badge do menu "Chat".
-- ---------------------------------------------------------------------------
create or replace function public.unread_staff_chat_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select count(*)::integer
  from public.staff_chat_messages m
  join public.staff_chat_threads t on t.id = m.thread_id
  left join public.staff_chat_reads r on r.thread_id = t.id and r.user_id = auth.uid()
  where (public.is_admin() or t.professional_id = auth.uid())
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$fn$;

grant execute on function public.unread_staff_chat_count() to authenticated;

revoke execute on all functions in schema public from anon;
