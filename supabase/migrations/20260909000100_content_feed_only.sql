-- =============================================================================
-- contents.feed_only: marca conteudo criado so pra compor o feed (upload
-- rapido em "Adicionar foto ao feed"), que nunca passa pelo fluxo real de
-- aprovacao do cliente -- add_feed_item() ja forca status='approved' nesses
-- casos so pra satisfazer a RLS de visibilidade do cliente, o que antes
-- inflava as contagens de "conteudos enviados/aprovados". Com a flag, essas
-- contagens passam a filtrar `feed_only = false`.
-- =============================================================================

alter table public.contents
  add column feed_only boolean not null default false;

-- Backfill: fotos ja criadas pelo upload rapido (titulo padrao do
-- QuickFeedUpload) sao retroativamente marcadas, pra zerar as contagens
-- infladas que ja existem hoje sem precisar recriar nada.
update public.contents
set feed_only = true
where title like 'Foto do feed —%';
