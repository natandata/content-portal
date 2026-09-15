alter table public.client_services add column start_date date;
alter table public.invoices add column attachment_path text;

create table public.professional_api_keys (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.professional_api_keys enable row level security;
-- Sem policy de leitura/escrita para authenticated/anon de proposito -- so a
-- serviceRole valida a chave (MCP) e gerencia (Server Action), mesmo padrao
-- de client_credentials.
