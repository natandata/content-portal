-- Recorrencia de cobrancas: Mensal (sem prazo final), 3 ou 6 meses (para
-- sozinho depois desse tanto de ciclos). Ver src/server/invoices/recurrence.ts
-- (cron diario que gera o proximo ciclo) e src/server/actions/invoices.ts.

alter table invoices
  add column if not exists recurrence text check (recurrence in ('monthly','3_months','6_months')),
  add column if not exists recurrence_group_id uuid,
  add column if not exists recurrence_cycle_number int,
  add column if not exists recurrence_total_cycles int,
  add column if not exists recurrence_cancelled boolean not null default false;

create index if not exists invoices_recurrence_group_idx on invoices (recurrence_group_id, recurrence_cycle_number desc)
  where recurrence_group_id is not null;

comment on column invoices.recurrence is 'monthly = repete todo mes sem prazo final; 3_months/6_months = repete mensalmente por esse total de ciclos e para sozinho.';
comment on column invoices.recurrence_group_id is 'Mesmo id em todas as cobrancas geradas pela mesma serie recorrente -- nulo pra cobranca avulsa.';
comment on column invoices.recurrence_cancelled is 'true interrompe a geracao de proximos ciclos -- setado em TODAS as linhas do grupo ao cancelar, pra o cron so precisar olhar a linha mais recente.';
