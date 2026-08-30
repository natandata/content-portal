-- =============================================================================
-- Notificacoes push
--
-- Uma inscricao por navegador/aparelho (o mesmo endpoint nunca se repete). O
-- envio de verdade acontece no servidor Next, com a chave VAPID — este arquivo
-- so cuida de onde a inscricao mora e quem pode ler/escrever cada linha.
-- =============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Cada um so ve e mexe nas proprias inscricoes — nunca nas de outra pessoa,
-- equipe ou cliente.
create policy "push_subscriptions_select" on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

-- Pergunta "quer ativar notificacoes?" uma vez so, depois do tour. Mesmo
-- padrao de `tour_seen_at`.
alter table public.users add column if not exists notifications_prompted_at timestamptz;
alter table public.clients add column if not exists notifications_prompted_at timestamptz;

create or replace function public.mark_notifications_prompted()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_client_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sem sessao' using errcode = 'insufficient_privilege';
  end if;

  v_client_id := public.current_client_id();

  if v_client_id is not null then
    update public.clients set notifications_prompted_at = now()
     where id = v_client_id and notifications_prompted_at is null;
  else
    update public.users set notifications_prompted_at = now()
     where id = auth.uid() and notifications_prompted_at is null;
  end if;
end;
$fn$;

grant execute on function public.mark_notifications_prompted() to authenticated;
revoke execute on all functions in schema public from anon;
