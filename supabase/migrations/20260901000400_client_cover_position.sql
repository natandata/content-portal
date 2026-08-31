-- =============================================================================
-- Posicao vertical da capa do cliente
--
-- object-cover corta a imagem para caber na faixa (card) ou no banner (tela
-- do cliente) — sem controle, o recorte automatico as vezes pega uma parte
-- sem graca da foto (torso em vez de rosto, por exemplo). Este campo guarda
-- o ponto vertical de ancoragem (0 = topo, 50 = centro, 100 = base), usado
-- como object-position nos dois lugares onde a capa aparece.
-- =============================================================================

alter table public.clients
  add column if not exists cover_position_y smallint not null default 50
    constraint clients_cover_position_y_range check (cover_position_y between 0 and 100);
