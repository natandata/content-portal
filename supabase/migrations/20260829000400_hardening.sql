-- =============================================================================
-- Content Portal — endurecimento apontado pelos advisors do Supabase
--
-- 1. search_path fixo em todas as funcoes (lint 0011).
-- 2. EXECUTE revogado de PUBLIC/anon: nenhuma funcao e chamavel sem sessao
--    (lints 0028). O que sobra concedido a `authenticated` e intencional:
--    as policies de RLS precisam executar os helpers como o papel do chamador.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- search_path
-- ----------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = '';
alter function public.enforce_content_file_limits() set search_path = '';
alter function public.enforce_feed_limit() set search_path = '';
alter function public.uuid_or_null(text) set search_path = '';
alter function public.storage_client_id(text) set search_path = '';

-- ----------------------------------------------------------------------------
-- Superficie de execucao
-- ----------------------------------------------------------------------------

-- Triggers rodam como dono da tabela: ninguem precisa chamar diretamente.
revoke all on function public.set_updated_at() from public;
revoke all on function public.enforce_content_file_limits() from public;
revoke all on function public.enforce_feed_limit() from public;

-- Helpers usados dentro das policies: apenas sessoes autenticadas.
revoke all on function public.uuid_or_null(text) from public;
revoke all on function public.storage_client_id(text) from public;
revoke all on function public.can_view_client(uuid) from public;
revoke all on function public.can_manage_client(uuid) from public;
revoke all on function public.content_client_id(uuid) from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.current_client_id() from public;

grant execute on function public.uuid_or_null(text) to authenticated;
grant execute on function public.storage_client_id(text) to authenticated;
grant execute on function public.can_view_client(uuid) to authenticated;
grant execute on function public.can_manage_client(uuid) to authenticated;
grant execute on function public.content_client_id(uuid) to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_client_id() to authenticated;

-- RPCs chamados pela aplicacao: somente sessoes autenticadas.
revoke all on function public.generate_access_code(text) from public;
revoke all on function public.submit_signed_contract(uuid, text) from public;
revoke all on function public.submit_approval(uuid, public.approval_status, text) from public;
revoke all on function public.add_feed_item(uuid, uuid) from public;
revoke all on function public.reorder_feed(uuid, uuid[]) from public;

grant execute on function public.generate_access_code(text) to authenticated;
grant execute on function public.submit_signed_contract(uuid, text) to authenticated;
grant execute on function public.submit_approval(uuid, public.approval_status, text) to authenticated;
grant execute on function public.add_feed_item(uuid, uuid) to authenticated;
grant execute on function public.reorder_feed(uuid, uuid[]) to authenticated;

-- O Supabase concede EXECUTE diretamente ao papel `anon` (default privileges do
-- schema public), entao revogar de PUBLIC nao basta: nenhuma funcao da aplicacao
-- deve ser chamavel sem sessao.
revoke execute on all functions in schema public from anon;
