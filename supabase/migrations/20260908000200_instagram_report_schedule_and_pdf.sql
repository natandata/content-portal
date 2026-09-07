-- =============================================================================
-- Relatorio automatico mensal do Instagram: dia do mes escolhido pelo
-- profissional, e um novo tipo de documento para o PDF entregue em
-- Documentos.
-- =============================================================================

-- Limite 28 (nao 31) de proposito -- todo mes tem dia 28, evita o cron pular
-- fevereiro ou cair sempre no ultimo dia em meses de tamanhos diferentes.
alter table public.client_instagram_report_settings
  add column if not exists auto_report_day integer not null default 1
    check (auto_report_day between 1 and 28);

alter type public.document_kind add value if not exists 'report';
