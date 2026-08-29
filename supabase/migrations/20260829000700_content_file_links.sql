-- ---------------------------------------------------------------------------
-- Arquivo por link externo
--
-- Video pesado nao precisa passar pelo Storage: o profissional cola um link
-- (Drive, WeTransfer, OneDrive...) e o cliente abre/baixa de la. Um registro de
-- content_files passa a ter DUAS origens possiveis, e exatamente uma delas.
-- ---------------------------------------------------------------------------

alter table public.content_files
  add column if not exists external_url text;

alter table public.content_files
  alter column file_path drop not null;

-- Ou o arquivo esta no Storage, ou esta atras de um link. Nunca os dois, nunca
-- nenhum dos dois.
alter table public.content_files
  drop constraint if exists content_files_source_check;
alter table public.content_files
  add constraint content_files_source_check check (
    (file_path is not null and external_url is null)
    or (file_path is null and external_url is not null)
  );

-- Barreira contra javascript:, data: e afins — o link vai virar href.
alter table public.content_files
  drop constraint if exists content_files_external_url_scheme;
alter table public.content_files
  add constraint content_files_external_url_scheme check (
    external_url is null or external_url ~* '^https?://[^[:space:]]+$'
  );
