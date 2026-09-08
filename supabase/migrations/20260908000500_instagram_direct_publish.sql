-- Publicacao direta no Instagram (feed/carrossel) a partir do calendario de
-- conteudo. `publish_status` fica separado de `contents.status` (fluxo de
-- aprovacao) de proposito -- ver src/server/actions/instagram-publish.ts.

alter table contents
  add column if not exists instagram_connection_id uuid references client_instagram_connections(id) on delete set null,
  add column if not exists publish_status text not null default 'idle'
    check (publish_status in ('idle','scheduled','publishing','published','failed')),
  add column if not exists publish_error text,
  add column if not exists publish_container_id text,
  add column if not exists instagram_media_id text,
  add column if not exists published_at timestamptz;

create index if not exists contents_publish_due_idx on contents (publish_status, scheduled_date)
  where publish_status = 'scheduled';

alter table client_instagram_connections
  add column if not exists publish_scope_granted boolean not null default false;

comment on column contents.publish_status is 'Mecanica de publicacao direta no Instagram -- separado de status (fluxo de aprovacao). idle = nunca tentou publicar direto.';
comment on column client_instagram_connections.publish_scope_granted is 'true assim que a conexao foi (re)feita depois do Auth Config da Composio ganhar o escopo de publicacao -- controla se o botao de publicar aparece habilitado.';
