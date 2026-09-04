-- =============================================================================
-- Idioma preferido do cliente
--
-- O toggle de idioma (LanguageToggle) so aparece na tela de login, antes de
-- existir sessao, e vive num cookie de navegador. Isso funciona para renderizar
-- a pagina, mas uma notificacao push e composta no servidor sem nenhum
-- navegador por perto -- precisa de um idioma persistido na conta do cliente,
-- nao no cookie de quem estiver olhando naquele momento.
-- =============================================================================

alter table public.clients
  add column if not exists preferred_locale text not null default 'pt-BR'
    check (preferred_locale in ('pt-BR', 'en'));

/*
 * Sincroniza o cookie de idioma (a fonte da verdade de tela) para a conta do
 * cliente, para o servidor saber depois, sem navegador nenhum por perto, em
 * que idioma compor uma notificacao push. Chamado de forma silenciosa a cada
 * carregamento autenticado do layout do cliente quando os dois divergem --
 * nao existe tela dedicada para isso.
 */
create or replace function public.set_preferred_locale(p_locale text)
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

  if p_locale not in ('pt-BR', 'en') then
    raise exception 'Idioma invalido' using errcode = 'invalid_parameter_value';
  end if;

  v_client_id := public.current_client_id();

  if v_client_id is not null then
    update public.clients set preferred_locale = p_locale
     where id = v_client_id and preferred_locale is distinct from p_locale;
  end if;
end;
$fn$;

grant execute on function public.set_preferred_locale(text) to authenticated;
revoke execute on all functions in schema public from anon;
