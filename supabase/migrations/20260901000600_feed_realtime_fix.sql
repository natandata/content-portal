-- =============================================================================
-- Tempo real do Feed: REPLICA IDENTITY e correcao de rascunho invisivel
--
-- REPLICA IDENTITY FULL nas tabelas com Realtime habilitado: garante que o
-- evento de UPDATE/DELETE carregue a linha inteira (nao so a chave primaria),
-- o que o RLS do Realtime precisa para decidir se entrega o evento a quem
-- assinou.
--
-- add_feed_item(): o cliente nunca enxerga conteudo em rascunho (RLS de
-- 20260829000500_hide_drafts_from_client.sql) — mas nada impedia colocar um
-- rascunho no feed, resultando num item que a equipe via mas o cliente nao.
-- Colocar no feed so faz sentido se o cliente for ver, entao a funcao agora
-- promove o conteudo pra fora do rascunho ao adicionar.
-- =============================================================================

alter table public.feed_items replica identity full;
alter table public.contents replica identity full;
alter table public.content_files replica identity full;
alter table public.client_profiles replica identity full;
alter table public.profile_highlights replica identity full;

create or replace function public.add_feed_item(
  p_client_id uuid,
  p_content_id uuid
)
returns public.feed_items
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_item public.feed_items;
  v_position smallint;
begin
  if not public.can_manage_client(p_client_id) then
    raise exception 'Sem permissao para este cliente' using errcode = 'insufficient_privilege';
  end if;

  if public.content_client_id(p_content_id) <> p_client_id then
    raise exception 'Conteudo nao pertence a este cliente' using errcode = 'check_violation';
  end if;

  -- Rascunho fica invisivel para o cliente (RLS): colocar no feed so faz
  -- sentido se o cliente for enxergar, entao promove pra fora do rascunho.
  update public.contents
  set status = 'approved'
  where id = p_content_id and status = 'draft';

  select min(p)::smallint into v_position
  from generate_series(1, 30) as p
  where not exists (
    select 1 from public.feed_items f
    where f.client_id = p_client_id and f.position = p
  );

  if v_position is null then
    raise exception 'O feed comporta no maximo 30 conteudos' using errcode = 'check_violation';
  end if;

  insert into public.feed_items (client_id, content_id, position)
  values (p_client_id, p_content_id, v_position)
  returning * into v_item;

  return v_item;
end;
$fn$;

-- Corrige conteudo que ja estava em algum feed em rascunho antes desta
-- migration existir (invisivel para o cliente ate agora). Sem efeito em
-- banco novo.
update public.contents c
set status = 'approved'
where status = 'draft'
  and exists (select 1 from public.feed_items fi where fi.content_id = c.id);
