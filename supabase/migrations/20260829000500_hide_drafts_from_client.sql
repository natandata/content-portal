-- =============================================================================
-- Content Portal — rascunho e invisivel para o cliente
--
-- A interface do cliente ja filtrava `status <> 'draft'`, mas o filtro vivia
-- apenas na aplicacao: uma chamada direta a API expunha titulo, legenda e
-- arquivos de conteudos ainda em producao. Agora a regra esta no banco.
-- =============================================================================

create or replace function public.content_is_draft(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.contents
    where id = p_content_id and status = 'draft'
  );
$fn$;

create or replace function public.storage_content_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $fn$
  select public.uuid_or_null((storage.foldername(p_name))[2]);
$fn$;

revoke all on function public.content_is_draft(uuid) from public;
revoke all on function public.storage_content_id(text) from public;
grant execute on function public.content_is_draft(uuid) to authenticated;
grant execute on function public.storage_content_id(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------
drop policy if exists "contents_select_scoped" on public.contents;
create policy "contents_select_scoped" on public.contents
  for select to authenticated
  using (
    public.can_view_client(client_id)
    -- Para a equipe `current_client_id()` e nulo; para o cliente, o rascunho some.
    and (public.current_client_id() is distinct from client_id or status <> 'draft')
  );

drop policy if exists "content_files_select_scoped" on public.content_files;
create policy "content_files_select_scoped" on public.content_files
  for select to authenticated
  using (
    public.can_view_client(public.content_client_id(content_id))
    and (
      public.current_client_id() is distinct from public.content_client_id(content_id)
      or not public.content_is_draft(content_id)
    )
  );

drop policy if exists "approval_history_select_scoped" on public.approval_history;
create policy "approval_history_select_scoped" on public.approval_history
  for select to authenticated
  using (
    public.can_view_client(public.content_client_id(content_id))
    and (
      public.current_client_id() is distinct from public.content_client_id(content_id)
      or not public.content_is_draft(content_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Storage: mesma regra para os arquivos em content/ e thumbnails/
-- ----------------------------------------------------------------------------
drop policy if exists "storage_read_scoped" on storage.objects;
create policy "storage_read_scoped" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('contracts', 'signed-contracts', 'content', 'thumbnails')
    and public.can_view_client(public.storage_client_id(name))
    and (
      bucket_id in ('contracts', 'signed-contracts')
      or public.current_client_id() is distinct from public.storage_client_id(name)
      or not public.content_is_draft(public.storage_content_id(name))
    )
  );

-- Repetido aqui porque as funcoes acima nascem depois da migration de
-- endurecimento e voltariam a ficar acessiveis ao papel `anon`.
revoke execute on all functions in schema public from anon;
