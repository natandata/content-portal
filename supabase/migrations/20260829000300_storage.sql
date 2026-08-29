-- =============================================================================
-- Content Portal — buckets e policies de Storage
-- Convencao de caminho: {bucket}/{client_id}/...
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('contracts', 'contracts', false, 26214400, array['application/pdf']),
  ('signed-contracts', 'signed-contracts', false, 26214400, array['application/pdf']),
  ('content', 'content', false, 524288000, null),
  ('thumbnails', 'thumbnails', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Primeiro segmento do caminho = client_id.
create or replace function public.storage_client_id(p_name text)
returns uuid
language sql
immutable
as $fn$
  select public.uuid_or_null((storage.foldername(p_name))[1]);
$fn$;

-- Leitura: admin, profissional responsavel ou o proprio cliente.
create policy "storage_read_scoped" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('contracts', 'signed-contracts', 'content', 'thumbnails')
    and public.can_view_client(public.storage_client_id(name))
  );

-- Escrita da equipe nos buckets de trabalho.
create policy "storage_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('contracts', 'content', 'thumbnails')
    and public.can_manage_client(public.storage_client_id(name))
  );

create policy "storage_staff_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('contracts', 'content', 'thumbnails')
    and public.can_manage_client(public.storage_client_id(name))
  )
  with check (
    bucket_id in ('contracts', 'content', 'thumbnails')
    and public.can_manage_client(public.storage_client_id(name))
  );

create policy "storage_staff_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('contracts', 'content', 'thumbnails')
    and public.can_manage_client(public.storage_client_id(name))
  );

-- Contrato assinado: enviado pelo cliente, tambem gravavel pela equipe.
create policy "storage_signed_contract_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'signed-contracts'
    and public.can_view_client(public.storage_client_id(name))
  );

create policy "storage_signed_contract_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'signed-contracts'
    and public.can_view_client(public.storage_client_id(name))
  )
  with check (
    bucket_id = 'signed-contracts'
    and public.can_view_client(public.storage_client_id(name))
  );

create policy "storage_signed_contract_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'signed-contracts'
    and public.can_manage_client(public.storage_client_id(name))
  );
