-- =============================================================================
-- Bucket do relatorio enviado na geracao de ideias de conteudo -- mesma
-- convencao {client_id}/... dos demais buckets. Aceita PDF ou imagem (o
-- profissional pode mandar o export do Meta Business Suite ou so um
-- screenshot dos numeros).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-idea-reports',
  'content-idea-reports',
  false,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Mesma observacao de 20260831000100_billing.sql: sem CREATE OR REPLACE
-- POLICY no Postgres, entao recria-se cada uma com o bucket novo incluido.
drop policy if exists "storage_read_scoped" on storage.objects;
create policy "storage_read_scoped" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('contracts', 'signed-contracts', 'content', 'thumbnails', 'invoices', 'content-idea-reports')
    and public.can_view_client(public.storage_client_id(name))
    and (
      bucket_id in ('contracts', 'signed-contracts', 'invoices', 'content-idea-reports')
      or public.current_client_id() is distinct from public.storage_client_id(name)
      or not public.content_is_draft(public.storage_content_id(name))
    )
  );

drop policy if exists "storage_staff_insert" on storage.objects;
create policy "storage_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('contracts', 'content', 'thumbnails', 'invoices', 'content-idea-reports')
    and public.can_manage_client(public.storage_client_id(name))
  );
