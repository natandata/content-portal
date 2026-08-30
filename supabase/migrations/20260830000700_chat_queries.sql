-- =============================================================================
-- Leitura do chat, com o nome de quem enviou ja resolvido
--
-- `users` so e legivel pelo proprio dono da linha ou por admin — um cliente
-- nunca poderia ler o nome do profissional direto. Estas funcoes rodam com
-- privilegio elevado por dentro (SECURITY DEFINER) exatamente para isso, mas
-- continuam checando can_view_client antes de devolver qualquer coisa.
-- =============================================================================

create or replace function public.chat_thread_messages(p_client_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  is_staff boolean,
  body text,
  link_target_type public.chat_link_target,
  link_target_id uuid,
  link_label text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.can_view_client(p_client_id) then
    raise exception 'Sem permissao para este cliente' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    m.id,
    m.sender_id,
    coalesce(u.name, c.name, '—') as sender_name,
    (u.id is not null) as is_staff,
    m.body,
    m.link_target_type,
    m.link_target_id,
    m.link_label,
    m.created_at
  from public.chat_messages m
  join public.chat_threads t on t.id = m.thread_id
  left join public.users u on u.id = m.sender_id
  left join public.clients c on c.auth_user_id = m.sender_id
  where t.client_id = p_client_id
  order by m.created_at;
end;
$fn$;

grant execute on function public.chat_thread_messages(uuid) to authenticated;

-- Marca o thread como lido ate agora, para quem chamou.
create or replace function public.mark_chat_read(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_thread_id uuid;
begin
  if not public.can_view_client(p_client_id) then
    raise exception 'Sem permissao para este cliente' using errcode = 'insufficient_privilege';
  end if;

  select id into v_thread_id from public.chat_threads where client_id = p_client_id;
  if v_thread_id is null then
    return;
  end if;

  insert into public.chat_reads (thread_id, user_id, last_read_at)
  values (v_thread_id, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$fn$;

grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Caixa de entrada da equipe: um thread por cliente que ela gerencia, com a
-- ultima mensagem e as nao-lidas. Para o cliente, devolve so o proprio.
-- ---------------------------------------------------------------------------
create or replace function public.chat_inbox()
returns table (
  client_id uuid,
  company_name text,
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
  return query
  select
    c.id,
    c.company_name,
    lm.body,
    lm.created_at,
    coalesce((
      select count(*)::integer
      from public.chat_messages m2
      where m2.thread_id = t.id
        and m2.sender_id <> auth.uid()
        and m2.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    ), 0)
  from public.clients c
  left join public.chat_threads t on t.client_id = c.id
  left join lateral (
    select body, created_at
    from public.chat_messages
    where thread_id = t.id
    order by created_at desc
    limit 1
  ) lm on true
  left join public.chat_reads r on r.thread_id = t.id and r.user_id = auth.uid()
  where public.can_view_client(c.id)
  order by coalesce(lm.created_at, c.created_at) desc;
end;
$fn$;

grant execute on function public.chat_inbox() to authenticated;

revoke execute on all functions in schema public from anon;
