-- =============================================================================
-- Relatorio de insights mais completo: stories ativos no momento da geracao
-- e um retrato atual do publico (idade/genero/cidade/pais) -- a Meta so
-- libera essas duas coisas como "agora", nunca historico do periodo.
-- =============================================================================

alter table public.instagram_insights_reports
  add column if not exists stories jsonb,
  add column if not exists audience jsonb;
