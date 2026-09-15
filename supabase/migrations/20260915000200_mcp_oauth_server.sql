create table public.mcp_oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table public.mcp_oauth_codes (
  code text primary key,
  client_id text not null references public.mcp_oauth_clients (client_id) on delete cascade,
  professional_id uuid not null references public.users (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
-- Sem policy de proposito -- so a serviceRole le/escreve (fluxo de OAuth do
-- servidor MCP, mesmo padrao de professional_api_keys).
