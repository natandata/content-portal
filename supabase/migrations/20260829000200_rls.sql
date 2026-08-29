-- =============================================================================
-- Content Portal — helpers de autorizacao, RLS e RPCs
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER para evitar recursao de policies)
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $fn$
  select role from public.users where id = auth.uid();
$fn$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$fn$;

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select id from public.clients where auth_user_id = auth.uid();
$fn$;

-- Leitura: admin, profissional responsavel ou o proprio cliente.
create or replace function public.can_view_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select p_client_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.clients c
      join public.users u on u.id = auth.uid()
      where c.id = p_client_id
        and c.professional_id = auth.uid()
        and u.status = 'active'
    )
    or exists (
      select 1 from public.clients c
      where c.id = p_client_id
        and c.auth_user_id = auth.uid()
        and c.status = 'active'
    )
  );
$fn$;

-- Escrita: admin ou profissional responsavel.
create or replace function public.can_manage_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select p_client_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.clients c
      join public.users u on u.id = auth.uid()
      where c.id = p_client_id
        and c.professional_id = auth.uid()
        and u.status = 'active'
    )
  );
$fn$;

create or replace function public.content_client_id(p_content_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select client_id from public.contents where id = p_content_id;
$fn$;

create or replace function public.uuid_or_null(p_value text)
returns uuid
language plpgsql
immutable
as $fn$
begin
  return p_value::uuid;
exception
  when others then
    return null;
end;
$fn$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.client_credentials enable row level security;
alter table public.contracts enable row level security;
alter table public.contents enable row level security;
alter table public.content_files enable row level security;
alter table public.approvals enable row level security;
alter table public.approval_history enable row level security;
alter table public.feed_items enable row level security;

-- users -----------------------------------------------------------------
create policy "users_select_self_or_admin" on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "users_admin_insert" on public.users
  for insert to authenticated
  with check (public.is_admin());

create policy "users_admin_update" on public.users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "users_admin_delete" on public.users
  for delete to authenticated
  using (public.is_admin());

-- clients ---------------------------------------------------------------
create policy "clients_select_scoped" on public.clients
  for select to authenticated
  using (
    public.is_admin()
    or professional_id = auth.uid()
    or auth_user_id = auth.uid()
  );

create policy "clients_insert_staff" on public.clients
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.current_user_role() = 'professional' and professional_id = auth.uid())
  );

create policy "clients_update_staff" on public.clients
  for update to authenticated
  using (public.is_admin() or professional_id = auth.uid())
  with check (public.is_admin() or professional_id = auth.uid());

create policy "clients_delete_admin" on public.clients
  for delete to authenticated
  using (public.is_admin());

-- client_credentials: nenhuma policy. Apenas service role acessa.

-- contracts -------------------------------------------------------------
create policy "contracts_select_scoped" on public.contracts
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "contracts_insert_staff" on public.contracts
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "contracts_update_staff" on public.contracts
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "contracts_delete_staff" on public.contracts
  for delete to authenticated
  using (public.can_manage_client(client_id));

-- contents --------------------------------------------------------------
create policy "contents_select_scoped" on public.contents
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "contents_insert_staff" on public.contents
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "contents_update_staff" on public.contents
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "contents_delete_staff" on public.contents
  for delete to authenticated
  using (public.can_manage_client(client_id));

-- content_files ---------------------------------------------------------
create policy "content_files_select_scoped" on public.content_files
  for select to authenticated
  using (public.can_view_client(public.content_client_id(content_id)));

create policy "content_files_insert_staff" on public.content_files
  for insert to authenticated
  with check (public.can_manage_client(public.content_client_id(content_id)));

create policy "content_files_update_staff" on public.content_files
  for update to authenticated
  using (public.can_manage_client(public.content_client_id(content_id)))
  with check (public.can_manage_client(public.content_client_id(content_id)));

create policy "content_files_delete_staff" on public.content_files
  for delete to authenticated
  using (public.can_manage_client(public.content_client_id(content_id)));

-- approvals -------------------------------------------------------------
create policy "approvals_select_scoped" on public.approvals
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "approvals_insert_client" on public.approvals
  for insert to authenticated
  with check (client_id = public.current_client_id());

-- approval_history ------------------------------------------------------
create policy "approval_history_select_scoped" on public.approval_history
  for select to authenticated
  using (public.can_view_client(public.content_client_id(content_id)));

create policy "approval_history_insert_scoped" on public.approval_history
  for insert to authenticated
  with check (public.can_view_client(public.content_client_id(content_id)));

-- feed_items ------------------------------------------------------------
create policy "feed_items_select_scoped" on public.feed_items
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "feed_items_insert_staff" on public.feed_items
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "feed_items_update_staff" on public.feed_items
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "feed_items_delete_staff" on public.feed_items
  for delete to authenticated
  using (public.can_manage_client(client_id));

-- ----------------------------------------------------------------------------
-- RPCs transacionais
-- ----------------------------------------------------------------------------

-- Cliente envia o contrato assinado.
create or replace function public.submit_signed_contract(
  p_contract_id uuid,
  p_file_path text
)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_contract public.contracts;
  v_client_id uuid;
begin
  select client_id into v_client_id from public.contracts where id = p_contract_id;
  if v_client_id is null then
    raise exception 'Contrato nao encontrado' using errcode = 'no_data_found';
  end if;

  if v_client_id <> public.current_client_id() then
    raise exception 'Sem permissao para este contrato' using errcode = 'insufficient_privilege';
  end if;

  update public.contracts
  set signed_file_path = p_file_path,
      signed_at = now(),
      status = 'under_review'
  where id = p_contract_id
  returning * into v_contract;

  return v_contract;
end;
$fn$;

-- Cliente aprova / reprova / solicita alteracao.
create or replace function public.submit_approval(
  p_content_id uuid,
  p_status public.approval_status,
  p_comment text default null
)
returns public.contents
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_client_id uuid;
  v_content public.contents;
  v_actor text;
  v_action text;
begin
  v_client_id := public.content_client_id(p_content_id);
  if v_client_id is null then
    raise exception 'Conteudo nao encontrado' using errcode = 'no_data_found';
  end if;

  if v_client_id <> public.current_client_id() then
    raise exception 'Sem permissao para este conteudo' using errcode = 'insufficient_privilege';
  end if;

  if p_status <> 'approved' and coalesce(btrim(p_comment), '') = '' then
    raise exception 'Comentario obrigatorio' using errcode = 'check_violation';
  end if;

  insert into public.approvals (content_id, client_id, status, comment, created_by)
  values (p_content_id, v_client_id, p_status, nullif(btrim(coalesce(p_comment, '')), ''), auth.uid());

  update public.contents
  set status = case p_status
        when 'approved' then 'approved'::public.content_status
        when 'rejected' then 'rejected'::public.content_status
        else 'revision_requested'::public.content_status
      end
  where id = p_content_id
  returning * into v_content;

  select name into v_actor from public.clients where id = v_client_id;

  v_action := case p_status
    when 'approved' then 'Cliente aprovou o conteudo'
    when 'rejected' then 'Cliente reprovou o conteudo'
    else 'Cliente solicitou alteracao'
  end;

  insert into public.approval_history (content_id, user_id, actor_name, action, comment)
  values (p_content_id, auth.uid(), v_actor, v_action,
          nullif(btrim(coalesce(p_comment, '')), ''));

  return v_content;
end;
$fn$;

-- Adiciona um conteudo na primeira posicao livre do feed.
create or replace function public.add_feed_item(
  p_client_id uuid,
  p_content_id uuid
)
returns public.feed_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.feed_items;
  v_position smallint;
begin
  if not public.can_manage_client(p_client_id) then
    raise exception 'Sem permissao para este cliente' using errcode = 'insufficient_privilege';
  end if;

  if public.content_client_id(p_content_id) <> p_client_id then
    raise exception 'Conteudo nao pertence a este cliente' using errcode = 'check_violation';
  end if;

  select min(p)::smallint into v_position
  from generate_series(1, 30) as p
  where not exists (
    select 1 from public.feed_items f
    where f.client_id = p_client_id and f.position = p
  );

  if v_position is null then
    raise exception 'O feed comporta no maximo 30 conteudos' using errcode = 'check_violation';
  end if;

  insert into public.feed_items (client_id, content_id, position)
  values (p_client_id, p_content_id, v_position)
  returning * into v_item;

  return v_item;
end;
$fn$;

-- Reordena o feed inteiro em uma unica transacao.
create or replace function public.reorder_feed(
  p_client_id uuid,
  p_content_ids uuid[]
)
returns setof public.feed_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_expected integer;
begin
  if not public.can_manage_client(p_client_id) then
    raise exception 'Sem permissao para este cliente' using errcode = 'insufficient_privilege';
  end if;

  if array_length(p_content_ids, 1) > 30 then
    raise exception 'O feed comporta no maximo 30 conteudos' using errcode = 'check_violation';
  end if;

  select count(*) into v_expected from public.feed_items where client_id = p_client_id;

  if v_expected <> coalesce(array_length(p_content_ids, 1), 0) then
    raise exception 'A ordenacao precisa conter todos os itens do feed'
      using errcode = 'check_violation';
  end if;

  set constraints public.feed_items_unique_position deferred;

  update public.feed_items f
  set position = ordinality::smallint
  from unnest(p_content_ids) with ordinality as t (content_id, ordinality)
  where f.client_id = p_client_id and f.content_id = t.content_id;

  return query
    select * from public.feed_items
    where client_id = p_client_id
    order by position;
end;
$fn$;

-- ----------------------------------------------------------------------------
-- Permissoes de execucao
-- ----------------------------------------------------------------------------
grant execute on function public.submit_signed_contract(uuid, text) to authenticated;
grant execute on function public.submit_approval(uuid, public.approval_status, text) to authenticated;
grant execute on function public.add_feed_item(uuid, uuid) to authenticated;
grant execute on function public.reorder_feed(uuid, uuid[]) to authenticated;
grant execute on function public.generate_access_code(text) to authenticated;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.current_client_id() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_client_id() to authenticated;
grant execute on function public.can_view_client(uuid) to authenticated;
grant execute on function public.can_manage_client(uuid) to authenticated;
grant execute on function public.content_client_id(uuid) to authenticated;
