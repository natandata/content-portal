-- =============================================================================
-- `report_file_path` precisa ser preenchido DEPOIS da linha existir -- o
-- caminho do arquivo no Storage inclui o id da geracao
-- (`{client_id}/{generation_id}/...`, ver `contentIdeaReportPath` em
-- `lib/paths.ts`), mesmo problema de ovo-e-galinha que `contracts`/
-- `invoices` resolvem criando a linha primeiro e anexando o arquivo depois.
-- =============================================================================

alter table public.content_idea_generations alter column report_file_path drop not null;
