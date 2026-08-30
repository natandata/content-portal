-- =============================================================================
-- Mural de novidades
--
-- O admin publica pacotes de atualizacao futuros; todo mundo (admin,
-- profissional, cliente) ve no dashboard e vota se gostou. Os votos em si nao
-- sao expostos por linha para usuario comum (senao um bastaria contar as
-- proprias linhas visiveis via RLS e nunca veria o total) — o total vem de um
-- RPC que agrega por dentro, e devolve so o proprio voto de quem chamou.
-- =============================================================================

create table if not exists public.bulletin_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  published boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bulletin_posts_published_idx
  on public.bulletin_posts (published, created_at desc);

create table if not exists public.bulletin_votes (
  post_id uuid not null references public.bulletin_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.bulletin_posts enable row level security;
alter table public.bulletin_votes enable row level security;

create trigger bulletin_posts_set_updated_at before update on public.bulletin_posts
  for each row execute function public.set_updated_at();

-- Post publicado e visivel a qualquer autenticado; rascunho so para admin.
create policy "bulletin_posts_select" on public.bulletin_posts
  for select to authenticated
  using (published or public.is_admin());

create policy "bulletin_posts_insert" on public.bulletin_posts
  for insert to authenticated
  with check (public.is_admin());

create policy "bulletin_posts_update" on public.bulletin_posts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "bulletin_posts_delete" on public.bulletin_posts
  for delete to authenticated
  using (public.is_admin());

-- Cada um so ve o proprio voto na tabela crua; o total agregado vem do RPC.
create policy "bulletin_votes_select_own" on public.bulletin_votes
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Feed do mural: cada post publicado com contagem e o voto de quem pediu.
-- ---------------------------------------------------------------------------
create or replace function public.bulletin_feed()
returns table (
  id uuid,
  title text,
  body text,
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

-- Vota, troca ou remove o proprio voto. p_vote: 1, -1 ou 0 (remove).
create or replace function public.vote_on_bulletin_post(p_post_id uuid, p_vote smallint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if p_vote not in (-1, 0, 1) then
    raise exception 'Voto invalido' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.bulletin_posts where id = p_post_id and published) then
    raise exception 'Publicacao nao encontrada' using errcode = 'no_data_found';
  end if;

  if p_vote = 0 then
    delete from public.bulletin_votes where post_id = p_post_id and user_id = auth.uid();
  else
    insert into public.bulletin_votes (post_id, user_id, vote)
    values (p_post_id, auth.uid(), p_vote)
    on conflict (post_id, user_id) do update set vote = excluded.vote, created_at = now();
  end if;
end;
$fn$;

grant execute on function public.vote_on_bulletin_post(uuid, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- Relatorio do admin: quem votou o que, em cada post (inclui rascunho).
-- ---------------------------------------------------------------------------
create or replace function public.bulletin_admin_report()
returns table (
  post_id uuid,
  title text,
  published boolean,
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

revoke execute on all functions in schema public from anon;
