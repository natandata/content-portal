-- =============================================================================
-- Content Portal — solicitacao de acesso com aprovacao do admin
--
-- Quem se cadastra pela tela de login vira um profissional com status
-- `pending`. O usuario de autenticacao e criado na hora (a senha fica com o
-- Supabase Auth, nunca em tabela nossa), mas nao serve para nada ate o admin
-- aprovar: o login recusa quem nao esta `active`, e os helpers de RLS
-- (`is_admin`, `can_view_client`, `can_manage_client`) ja exigiam `active`.
-- =============================================================================

alter type public.user_status add value if not exists 'pending';

-- Quando a solicitacao chegou. Nulo para quem foi criado pelo admin.
alter table public.users
  add column if not exists requested_at timestamptz;

create index if not exists users_status_idx on public.users (status);

comment on column public.users.requested_at is
  'Preenchido quando o usuario se cadastrou sozinho e aguarda aprovacao do admin.';
