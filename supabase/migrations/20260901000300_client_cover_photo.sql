-- =============================================================================
-- Capa do cliente
--
-- Uma imagem de capa por cliente, usada tanto no card da galeria (Clientes)
-- quanto no topo da tela aberta do cliente — mesma imagem, exibida com um
-- recorte (object-fit) diferente em cada lugar. Guarda so o caminho no bucket
-- 'profiles', ja usado para foto de perfil e capas de destaque do feed.
-- =============================================================================

alter table public.clients add column if not exists cover_path text;
