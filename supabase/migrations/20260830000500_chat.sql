-- =============================================================================
-- Chat interno: profissional <-> cliente
--
-- Um thread por cliente — nao por par de pessoas. Quem participa e quem ja
-- participa de tudo o mais daquele cliente (admin + profissional responsavel);
-- o cliente so tem esse unico thread. Mesma regra de acesso do resto do app
-- (can_view_client), sem inventar um modelo de permissao novo so para o chat.
-- =============================================================================

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Para onde o "toggle" do profissional aponta. Guardamos um destino
-- estruturado (tipo + id opcional), nao uma URL — o link e resolvido na hora
-- de exibir, usando o prefixo de quem esta olhando (/client/... ou
-- /admin/...). Isso fecha a porta para link externo ou redirecionamento
-- fora do app.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_link_target') then
    create type public.chat_link_target as enum ('dashboard', 'content', 'documents', 'feed');
  end if;
end
$$;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '',
  link_target_type public.chat_link_target,
  link_target_id uuid,
  link_label text,
  created_at timestamptz not null default now(),
  constraint chat_messages_content_check check (
    btrim(body) <> '' or link_target_type is not null
  ),
  constraint chat_messages_link_id_check check (
    (link_target_type = 'content' and link_target_id is not null)
    or (link_target_type is distinct from 'content' and link_target_id is null)
  )
);

create index if not exists chat_messages_thread_id_idx
  on public.chat_messages (thread_id, created_at);

-- Marca ate onde cada pessoa leu, por thread. Generaliza para N participantes
-- (admin, profissional, cliente) sem precisar de uma coluna por papel.
create table if not exists public.chat_reads (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;

-- Leitura de thread e mensagens: quem ve o cliente ve a conversa. Escrita de
-- mensagem so pelo RPC abaixo (o cliente nao pode anexar link; o profissional
-- so pode apontar para conteudo do proprio cliente).
create policy "chat_threads_select" on public.chat_threads
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "chat_messages_select" on public.chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and public.can_view_client(t.client_id)
    )
  );

create policy "chat_reads_select" on public.chat_reads
  for select to authenticated
  using (user_id = auth.uid());

create policy "chat_reads_upsert" on public.chat_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and public.can_view_client(t.client_id)
    )
  );

create policy "chat_reads_update" on public.chat_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Envio de mensagem. Cria o thread na primeira mensagem (clientes cadastrados
-- antes deste recurso existir nao tem thread previo) e valida o link:
--   - so profissional/admin (quem gerencia o cliente) pode anexar link
--   - link para conteudo so aponta para conteudo do mesmo cliente
-- ---------------------------------------------------------------------------
create or replace function public.send_chat_message(
  p_client_id uuid,
  p_body text,
  p_link_target_type public.chat_link_target default null,
  p_link_target_id uuid default null,
  p_link_label text default null
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_thread_id uuid;
  v_message public.chat_messages;
begin
  if not public.can_view_client(p_client_id) then
    raise exception 'Sem permissao para este cliente' using errcode = 'insufficient_privilege';
  end if;

  if p_link_target_type is not null and not public.can_manage_client(p_client_id) then
    raise exception 'Somente a equipe pode enviar um link' using errcode = 'insufficient_privilege';
  end if;

  if p_link_target_type = 'content' then
    if not exists (
      select 1 from public.contents c where c.id = p_link_target_id and c.client_id = p_client_id
    ) then
      raise exception 'Conteudo nao pertence a este cliente' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.chat_threads (client_id)
  values (p_client_id)
  on conflict (client_id) do nothing;

  select id into v_thread_id from public.chat_threads where client_id = p_client_id;

  insert into public.chat_messages (
    thread_id, sender_id, body, link_target_type, link_target_id, link_label
  )
  values (
    v_thread_id, auth.uid(), coalesce(btrim(p_body), ''),
    p_link_target_type, p_link_target_id, nullif(btrim(coalesce(p_link_label, '')), '')
  )
  returning * into v_message;

  return v_message;
end;
$fn$;

grant execute on function public.send_chat_message(
  uuid, text, public.chat_link_target, uuid, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Nao-lidas por thread, para o numero ao lado de "Chat" no menu.
-- ---------------------------------------------------------------------------
create or replace function public.unread_chat_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select count(*)::integer
  from public.chat_messages m
  join public.chat_threads t on t.id = m.thread_id
  left join public.chat_reads r on r.thread_id = t.id and r.user_id = auth.uid()
  where public.can_view_client(t.client_id)
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$fn$;

grant execute on function public.unread_chat_count() to authenticated;

revoke execute on all functions in schema public from anon;
