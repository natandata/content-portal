-- =============================================================================
-- Ideia pode (opcionalmente) pertencer a um cliente.
--
-- `on delete set null`: apagar o cliente nao apaga a ideia — a anotacao segue
-- valendo como referencia solta, igual acontece com tasks.client_id.
-- =============================================================================

alter table public.ideas
  add column client_id uuid references public.clients (id) on delete set null;

create index ideas_client_id_idx on public.ideas (client_id);
