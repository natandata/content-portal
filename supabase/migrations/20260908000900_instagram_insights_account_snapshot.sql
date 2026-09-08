-- Mostra de qual conta Instagram o relatorio veio (um cliente pode ter mais
-- de uma conta conectada) -- snapshot na hora da geracao, nao muda se a
-- conexao for renomeada/desconectada depois.

alter table instagram_insights_reports add column if not exists instagram_username text;
comment on column instagram_insights_reports.instagram_username is 'Snapshot do @ da conta no momento da geracao -- nao muda se a conexao for renomeada/desconectada depois, pro relatorio sempre mostrar de onde os dados vieram.';
