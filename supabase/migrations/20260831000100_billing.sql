-- =============================================================================
-- Cobrancas (pagamentos)
--
-- O profissional cobra o cliente de tres formas: sobe um boleto (PDF), manda
-- um link de pagamento, ou passa uma chave Pix. Uma cobranca tem exatamente
-- um metodo — nao mistura os tres num registro so. O cliente nunca escreve
-- nesta tabela: so le, baixa o boleto e copia link/chave. Marcar como paga e
-- sempre acao da equipe (can_manage_client), igual ao resto da area de
-- documentos.
-- =============================================================================

create type public.invoice_method as enum ('boleto', 'link', 'pix');
create type public.invoice_status as enum ('open', 'paid');
create type public.currency_code as enum ('BRL', 'USD', 'EUR', 'GBP');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  method public.invoice_method not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency_code not null default 'BRL',
  due_date date not null,
  boleto_file_path text,
  payment_link text,
  pix_key text,
  status public.invoice_status not null default 'open',
  paid_at timestamptz,
  paid_by uuid references public.users (id) on delete set null,
  -- Guarda o dia (no fuso do app) do ultimo lembrete diario ja enviado, para
  -- o cron nao mandar duas notificacoes iguais se rodar de novo no mesmo dia.
  last_reminder_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_link_payload_check check (
    method <> 'link' or (payment_link is not null and payment_link ~* '^https?://[^[:space:]]+$')
  ),
  constraint invoices_pix_payload_check check (
    method <> 'pix' or (pix_key is not null and btrim(pix_key) <> '')
  )
);

create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_due_date_idx on public.invoices (due_date);

create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

create policy "invoices_select_scoped" on public.invoices
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "invoices_insert_staff" on public.invoices
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "invoices_update_staff" on public.invoices
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "invoices_delete_staff" on public.invoices
  for delete to authenticated
  using (public.can_manage_client(client_id));

-- ----------------------------------------------------------------------------
-- Bucket do boleto — mesma convencao {client_id}/... dos demais buckets.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- As policies de storage.objects de 20260829000300 listam os buckets por
-- nome — sem CREATE OR REPLACE POLICY no Postgres, entao recria-se cada uma
-- com 'invoices' incluida. "storage_read_scoped" foi reescrita por
-- 20260829000500 para tambem esconder arquivo de rascunho do cliente — essa
-- clausula tem que sobreviver aqui, senao volta a vazar rascunho.
drop policy if exists "storage_read_scoped" on storage.objects;
create policy "storage_read_scoped" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('contracts', 'signed-contracts', 'content', 'thumbnails', 'invoices')
    and public.can_view_client(public.storage_client_id(name))
    and (
      bucket_id in ('contracts', 'signed-contracts', 'invoices')
      or public.current_client_id() is distinct from public.storage_client_id(name)
      or not public.content_is_draft(public.storage_content_id(name))
    )
  );

drop policy if exists "storage_staff_insert" on storage.objects;
create policy "storage_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('contracts', 'content', 'thumbnails', 'invoices')
    and public.can_manage_client(public.storage_client_id(name))
  );

drop policy if exists "storage_staff_update" on storage.objects;
create policy "storage_staff_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('contracts', 'content', 'thumbnails', 'invoices')
    and public.can_manage_client(public.storage_client_id(name))
  )
  with check (
    bucket_id in ('contracts', 'content', 'thumbnails', 'invoices')
    and public.can_manage_client(public.storage_client_id(name))
  );

drop policy if exists "storage_staff_delete" on storage.objects;
create policy "storage_staff_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('contracts', 'content', 'thumbnails', 'invoices')
    and public.can_manage_client(public.storage_client_id(name))
  );

revoke execute on all functions in schema public from anon;
