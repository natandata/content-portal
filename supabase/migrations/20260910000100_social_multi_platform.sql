-- =============================================================================
-- Publicacao multi-rede: TikTok, LinkedIn, Facebook, Pinterest, YouTube.
-- Instagram mantem seu proprio mecanismo (client_instagram_connections +
-- colunas dedicadas em contents) sem nenhuma mudanca -- essas tabelas novas
-- cobrem so as redes adicionais, evitando risco na integracao que ja
-- funciona em producao.
--
-- Uma tabela unica de conexao (em vez de 5 quase-identicas) porque cada
-- rede so difere no formato de `platform_data` (ex.: Facebook guarda
-- page_id/page_access_token, Pinterest guarda board_id escolhido, LinkedIn
-- guarda o author_urn). `content_publish_targets` e' 1 linha por
-- (conteudo, rede) -- o mesmo conteudo pode ir pra varias redes, cada uma
-- com seu proprio status/erro, sem interferir umas nas outras.
--
-- Sem policy de RLS de proposito (mesmo padrao de client_instagram_connections):
-- so o client admin (service role) mexe aqui, nunca direto do navegador.
-- =============================================================================

create type public.social_platform as enum ('tiktok', 'linkedin', 'facebook', 'pinterest', 'youtube');

create table public.client_social_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  platform public.social_platform not null,
  composio_connection_id text not null,
  label text,
  -- Formato varia por rede: Facebook {page_id, page_name}; Pinterest
  -- {board_id, board_name}; LinkedIn {author_urn, author_name}; TikTok e
  -- YouTube nao precisam de nada extra (fica {}).
  platform_data jsonb not null default '{}'::jsonb,
  is_principal boolean not null default false,
  connected_at timestamptz not null default now(),
  unique (client_id, platform, composio_connection_id)
);

create index client_social_connections_client_idx on public.client_social_connections (client_id, platform);

alter table public.client_social_connections enable row level security;

create table public.content_publish_targets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  platform public.social_platform not null,
  connection_id uuid not null references public.client_social_connections (id) on delete cascade,
  status text not null default 'idle' check (status in ('idle', 'scheduled', 'publishing', 'published', 'failed')),
  error text,
  -- publish_id (TikTok, assincrono) ou post/pin/video id final, conforme a rede.
  external_ref text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, platform)
);

create index content_publish_targets_content_idx on public.content_publish_targets (content_id);
create index content_publish_targets_due_idx on public.content_publish_targets (status) where status in ('scheduled', 'publishing');

create trigger content_publish_targets_set_updated_at before update on public.content_publish_targets
  for each row execute function public.set_updated_at();

alter table public.content_publish_targets enable row level security;
