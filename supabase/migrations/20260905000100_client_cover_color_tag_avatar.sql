-- =============================================================================
-- Card de Clientes: capa em cor (sem imagem), tag e foto editavel pelo cliente
-- =============================================================================

alter table public.clients
  add column if not exists cover_color text not null default 'sunset';

alter table public.clients
  add column if not exists tag text
    constraint clients_tag_length check (tag is null or char_length(tag) <= 40);

/*
 * Foto de perfil do cliente ja mora em `client_profiles.avatar_path` (o mesmo
 * registro usado pela simulacao do feed) -- nao duplicamos a coluna. O que
 * falta e um jeito do PROPRIO cliente gravar so esse campo: a policy de
 * escrita de `client_profiles` e `can_manage_client`, que so a equipe passa.
 * RPC no mesmo padrao de `mark_tour_seen`: mexe so na propria linha, so essa
 * coluna, e cria o registro se ainda nao existir (upsert).
 */
create or replace function public.set_client_avatar(p_avatar_path text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_client_id uuid;
begin
  v_client_id := public.current_client_id();

  if v_client_id is null then
    raise exception 'Apenas clientes podem chamar esta funcao' using errcode = 'insufficient_privilege';
  end if;

  insert into public.client_profiles (client_id, avatar_path)
  values (v_client_id, p_avatar_path)
  on conflict (client_id) do update set avatar_path = excluded.avatar_path, updated_at = now();
end;
$fn$;

grant execute on function public.set_client_avatar(text) to authenticated;
revoke execute on all functions in schema public from anon;
