-- =============================================================================
-- 1) Contratos viram Documentos
--
-- O modulo deixa de ser so contrato: passa a receber estrategia de conteudo,
-- brandbook, mockup e afins. A tabela continua se chamando `contracts` de
-- proposito — renomear tabela, policies, RPC e buckets do Storage nao muda nada
-- para quem usa e traria risco a troco de estetica interna.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_kind') then
    create type public.document_kind as enum (
      'contract',
      'strategy',
      'brandbook',
      'mockup',
      'other'
    );
  end if;
end
$$;

alter table public.contracts
  add column if not exists kind public.document_kind not null default 'contract';

-- Só contrato exige devolucao assinada; o resto e entrega.
alter table public.contracts
  add column if not exists requires_signature boolean not null default true;

-- Estado final de um documento que nao pede assinatura.
alter type public.contract_status add value if not exists 'delivered';

create index if not exists contracts_kind_idx on public.contracts (client_id, kind);

-- =============================================================================
-- 2) Painel de saude da plataforma (somente admin)
-- =============================================================================

create table if not exists public.platform_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  database_bytes bigint not null,
  storage_bytes bigint not null,
  users_count integer not null,
  clients_count integer not null,
  contents_count integer not null
);

create index if not exists platform_snapshots_captured_at_idx
  on public.platform_snapshots (captured_at desc);

alter table public.platform_snapshots enable row level security;

create policy "platform_snapshots_select" on public.platform_snapshots
  for select to authenticated
  using (public.is_admin());

create policy "platform_snapshots_insert" on public.platform_snapshots
  for insert to authenticated
  with check (public.is_admin());

/*
 * Tamanho de banco e de Storage nao sai pelo PostgREST: depende de
 * pg_database_size e de storage.objects. Esta funcao e a unica porta, e ela
 * mesma checa se quem chamou e admin — nao basta a policy, porque SECURITY
 * DEFINER ignora RLS.
 *
 * De quebra grava uma medicao por semana, para a tabela de consumo ter historico
 * sem depender de agendador.
 */
create or replace function public.platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $fn$
declare
  v_database_bytes bigint;
  v_storage_bytes bigint;
  v_users integer;
  v_clients integer;
  v_contents integer;
  v_last timestamptz;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Apenas o administrador pode ver a saude da plataforma'
      using errcode = '42501';
  end if;

  select pg_database_size(current_database()) into v_database_bytes;

  select coalesce(sum((metadata->>'size')::bigint), 0)
    into v_storage_bytes
    from storage.objects;

  select count(*) into v_users from public.users;
  select count(*) into v_clients from public.clients;
  select count(*) into v_contents from public.contents;

  -- Uma medicao por semana, gravada na primeira visita depois de sete dias.
  select max(captured_at) into v_last from public.platform_snapshots;
  if v_last is null or v_last < now() - interval '7 days' then
    insert into public.platform_snapshots (
      database_bytes, storage_bytes, users_count, clients_count, contents_count
    )
    values (v_database_bytes, v_storage_bytes, v_users, v_clients, v_contents);
  end if;

  select jsonb_build_object(
    'database_bytes', v_database_bytes,
    'storage_bytes', v_storage_bytes,
    'postgres_version', current_setting('server_version'),
    'tables', coalesce((
      select jsonb_agg(t order by t.bytes desc)
      from (
        select c.relname as name,
               pg_total_relation_size(c.oid) as bytes,
               coalesce(s.n_live_tup, 0) as rows
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_stat_user_tables s on s.relid = c.oid
        where n.nspname = 'public' and c.relkind = 'r'
      ) t
    ), '[]'::jsonb),
    'buckets', coalesce((
      select jsonb_agg(b order by b.bytes desc)
      from (
        select o.bucket_id as name,
               count(*)::integer as files,
               coalesce(sum((o.metadata->>'size')::bigint), 0) as bytes
        from storage.objects o
        group by o.bucket_id
      ) b
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'users', v_users,
      'clients', v_clients,
      'contents', v_contents,
      'content_files', (select count(*) from public.content_files),
      'documents', (select count(*) from public.contracts),
      'approvals', (select count(*) from public.approvals),
      'history', (select count(*) from public.approval_history),
      'feed_items', (select count(*) from public.feed_items),
      'highlights', (select count(*) from public.profile_highlights)
    ),
    'snapshots', coalesce((
      select jsonb_agg(s order by s.captured_at desc)
      from (
        select captured_at, database_bytes, storage_bytes,
               users_count, clients_count, contents_count
        from public.platform_snapshots
        order by captured_at desc
        limit 8
      ) s
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$fn$;

/*
 * Arquivos orfaos: objetos no Storage sem nenhuma linha correspondente no banco.
 * Aparecem quando um upload conclui e a gravacao seguinte falha. Somente
 * listagem — quem apaga e a aplicacao, com confirmacao.
 */
create or replace function public.orphan_storage_objects()
returns table (bucket_id text, name text, size bigint)
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Apenas o administrador pode listar arquivos orfaos'
      using errcode = '42501';
  end if;

  return query
  select o.bucket_id::text,
         o.name::text,
         coalesce((o.metadata->>'size')::bigint, 0)
  from storage.objects o
  where (o.bucket_id = 'content'
          and not exists (select 1 from public.content_files f where f.file_path = o.name))
     or (o.bucket_id = 'thumbnails'
          and not exists (select 1 from public.content_files f where f.thumbnail_path = o.name))
     or (o.bucket_id = 'contracts'
          and not exists (select 1 from public.contracts c where c.original_file_path = o.name))
     or (o.bucket_id = 'signed-contracts'
          and not exists (select 1 from public.contracts c where c.signed_file_path = o.name))
     or (o.bucket_id = 'profiles'
          and not exists (
            select 1 from public.client_profiles p where p.avatar_path = o.name
            union all
            select 1 from public.profile_highlights h where h.cover_path = o.name
          ));
end;
$fn$;

revoke execute on all functions in schema public from anon;

-- Documento entregue so para leitura nao aceita devolucao assinada. A tela ja
-- esconde o botao; isto fecha a porta tambem pela API.
create or replace function public.submit_signed_contract(
  p_contract_id uuid,
  p_file_path text
)
returns public.contracts
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_contract public.contracts;
  v_client_id uuid;
  v_requires boolean;
begin
  select client_id, requires_signature
    into v_client_id, v_requires
    from public.contracts
   where id = p_contract_id;

  if v_client_id is null then
    raise exception 'Documento nao encontrado' using errcode = 'no_data_found';
  end if;

  if v_client_id <> public.current_client_id() then
    raise exception 'Sem permissao para este documento' using errcode = 'insufficient_privilege';
  end if;

  if v_requires is not true then
    raise exception 'Este documento nao pede devolucao assinada'
      using errcode = 'check_violation';
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

grant execute on function public.submit_signed_contract(uuid, text) to authenticated;
revoke execute on all functions in schema public from anon;
