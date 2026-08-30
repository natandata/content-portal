-- =============================================================================
-- Tour de primeiro acesso
--
-- O "ja vi o tour" mora na conta, nao no navegador: trocar de aparelho nao pode
-- fazer o tutorial voltar.
-- =============================================================================

alter table public.users add column if not exists tour_seen_at timestamptz;
alter table public.clients add column if not exists tour_seen_at timestamptz;

/*
 * Marca o tour como visto para quem esta logado, seja equipe ou cliente.
 * Vai por RPC em vez de UPDATE direto para nao precisar abrir a policy de
 * escrita de `users`/`clients` — a funcao so mexe na propria linha de quem
 * chamou, e em mais nada.
 */
create or replace function public.mark_tour_seen()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_client_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sem sessao' using errcode = 'insufficient_privilege';
  end if;

  v_client_id := public.current_client_id();

  if v_client_id is not null then
    update public.clients set tour_seen_at = now()
     where id = v_client_id and tour_seen_at is null;
  else
    update public.users set tour_seen_at = now()
     where id = auth.uid() and tour_seen_at is null;
  end if;
end;
$fn$;

grant execute on function public.mark_tour_seen() to authenticated;
revoke execute on all functions in schema public from anon;
