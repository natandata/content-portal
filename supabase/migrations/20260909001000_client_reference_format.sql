-- =============================================================================
-- client_references.format: classifica cada referencia como "static" (foto/
-- carrossel) ou "video" -- mostrado como selo (Estatico/Video) na lista, pra
-- o profissional/cliente saberem de cara que tipo de conteudo a referencia
-- pede antes de abrir o link.
-- =============================================================================

alter table public.client_references
  add column format text not null default 'video' check (format in ('static', 'video'));
