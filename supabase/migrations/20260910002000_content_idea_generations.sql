-- =============================================================================
-- Geracao de ideias de conteudo por IA a partir de perfis de referencia do
-- Instagram + relatorio de metricas enviado pelo profissional. Mesmo espirito
-- assincrono de `instagram_public_reports` (dispara, mostra "processando",
-- confirma sozinho por webhook), mas cobre MULTIPLOS perfis por geracao (o
-- proprio cliente + ate 5 referencias) e termina criando rascunhos de
-- verdade em `contents`, nao so um relatorio pra ler.
-- =============================================================================

create type public.content_idea_generation_status as enum (
  'pending',
  'scraping',
  'analyzing',
  'done',
  'failed'
);

create table public.content_idea_generations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  requested_by uuid references public.users (id),
  status public.content_idea_generation_status not null default 'pending',

  -- Entrada do formulario.
  client_username text not null,
  reference_usernames text[] not null
    check (array_length(reference_usernames, 1) between 1 and 5),
  report_file_path text not null,

  -- Rastreio dos 2 runs da Apify (bio + posts -- resultsType e unico por
  -- run, entao precisa de dois). So a segunda entrega a completar dispara a
  -- etapa de IA (ver rota do webhook).
  apify_details_run_id text,
  apify_posts_run_id text,
  -- {username: {...bio/seguidores, cru como a Apify devolve}}
  profiles_summary jsonb,
  -- {username: [{caption, displayUrl, ...}]} -- ate 9 posts por perfil.
  profiles_posts jsonb,

  -- Saida da IA, mantida mesmo depois de virar rascunhos (auditoria/debug
  -- caso algo saia estranho num rascunho gerado).
  generated_ideas jsonb,
  created_content_ids uuid[],

  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.content_idea_generations enable row level security;

-- So leitura: toda escrita passa por Server Action/webhook via serviceRole
-- (mesmo padrao de `instagram_public_reports` -- sem policy de INSERT/UPDATE).
create policy "content_idea_generations_select_staff"
  on public.content_idea_generations
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.id = client_id and c.professional_id = auth.uid()
    )
  );

create index content_idea_generations_client_id_idx
  on public.content_idea_generations (client_id, created_at desc);
