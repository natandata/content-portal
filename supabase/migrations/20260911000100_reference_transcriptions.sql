-- =============================================================================
-- Remove a geracao de ideias baseada em scraping de perfis do Instagram
-- (implementada e revertida no mesmo dia) -- substituida por transcricao +
-- reescrita dos links ja cadastrados no Banco de Referencias do cliente.
-- =============================================================================

drop table if exists public.content_idea_generations;
drop type if exists public.content_idea_generation_status;

-- O bucket 'content-idea-reports' fica orfao (a Storage API bloqueia DELETE
-- direto em storage.buckets via SQL) -- sem policy de leitura/escrita
-- abaixo, ninguem mais consegue usa-lo; apagar de verdade fica pra depois,
-- via dashboard/Storage API, se algum dia importar.

-- Sem CREATE OR REPLACE POLICY no Postgres -- recria cada uma sem o bucket
-- 'content-idea-reports' (mesmo padrao de toda migracao que mexe em bucket).
drop policy if exists "storage_read_scoped" on storage.objects;
create policy "storage_read_scoped" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('contracts', 'signed-contracts', 'content', 'thumbnails', 'invoices')
    and public.can_view_client(public.storage_client_id(name))
    and (
      bucket_id in ('contracts', 'signed-contracts', 'invoices')
      or public.current_client_id() is distinct from public.storage_client_id(name)
      or not public.content_is_draft(public.storage_content_id(name))
    )
  );

drop policy if exists "storage_staff_insert" on storage.objects;
create policy "storage_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('contracts', 'content', 'thumbnails', 'invoices')
    and public.can_manage_client(public.storage_client_id(name))
  );

-- =============================================================================
-- Transcricao + reescrita de links do Banco de Referencias.
--
-- A equipe escolhe quais links (client_references) processar; cada linha
-- aqui representa 1 video processado. O trabalho pesado (baixar o video com
-- yt-dlp, transcrever e reescrever via Gemini) roda num worker do Railway,
-- disparado sob demanda (sem polling -- ver `src/lib/railway/client.ts`),
-- que le as linhas 'pending' e escreve o resultado de volta. Mesmo espirito
-- assincrono de `instagram_public_reports`.
-- =============================================================================

create type public.client_reference_transcription_status as enum (
  'pending',
  'processing',
  'done',
  'failed'
);

create table public.client_reference_transcriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  reference_id uuid not null references public.client_references (id) on delete cascade,
  requested_by uuid references public.users (id),
  status public.client_reference_transcription_status not null default 'pending',
  -- Transcricao crua do audio, como o Gemini devolve.
  transcript text,
  -- Mesmo conteudo, reescrito com outras palavras (nao plagio literal).
  rewritten_text text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.client_reference_transcriptions enable row level security;

-- So leitura: toda escrita passa por Server Action/worker via serviceRole
-- (mesmo padrao de `instagram_public_reports`).
create policy "client_reference_transcriptions_select_staff"
  on public.client_reference_transcriptions
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.id = client_id and c.professional_id = auth.uid()
    )
  );

create index client_reference_transcriptions_client_id_idx
  on public.client_reference_transcriptions (client_id, created_at desc);
