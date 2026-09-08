-- Separado da migracao anterior de proposito: um novo valor de enum
-- (`sent_for_signature`) so pode ser usado depois de commitado -- nao da
-- pra referenciar ele numa constraint na MESMA transacao que o cria.

alter table contracts
  add column if not exists signature_provider text not null default 'manual'
    check (signature_provider in ('manual','gov_br','autentique')),
  add column if not exists autentique_document_id text,
  add column if not exists autentique_signer_name text,
  add column if not exists autentique_signer_email text,
  add column if not exists autentique_signer_cpf text,
  add column if not exists autentique_sent_at timestamptz,
  add column if not exists autentique_signed_at timestamptz,
  add column if not exists autentique_error text;

comment on column contracts.signature_provider is 'Qual caminho de assinatura foi escolhido pra este documento -- manual (upload), gov_br (link externo) ou autentique (API real).';
comment on column contracts.autentique_document_id is 'ID do documento no Autentique -- correlaciona com o payload do webhook global.';

create table if not exists autentique_webhook_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

comment on table autentique_webhook_events is 'Reserva de idempotencia pros eventos do webhook global do Autentique -- mesmo padrao do calendly_webhook_events.';

alter table autentique_webhook_events enable row level security;
