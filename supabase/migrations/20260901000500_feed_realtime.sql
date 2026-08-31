-- =============================================================================
-- Tempo real do Feed
--
-- O cliente so via a atualizacao do feed na proxima navegacao (o RSC busca
-- de novo, mas quem ja estava com a pagina aberta ficava com a versao
-- antiga ate recarregar). Habilita Realtime nas tabelas que compoem o feed
-- e o perfil simulado — a pagina do cliente assina mudancas e so pede uma
-- nova renderizacao (router.refresh) quando algo muda, sem expor dado
-- nenhum pelo canal (RLS de select continua valendo: o cliente so recebe
-- eventos de linhas que ja podia ler).
-- =============================================================================

alter publication supabase_realtime add table
  public.feed_items,
  public.contents,
  public.content_files,
  public.client_profiles,
  public.profile_highlights;
