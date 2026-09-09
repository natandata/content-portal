-- =============================================================================
-- client_services: adiciona o modelo de parceria — um servico combinado sem
-- cobranca em dinheiro (permuta, cortesia, parceria de divulgacao). `amount`
-- deixa de ser obrigatorio: fica nulo quando `is_partnership` e verdadeiro, e
-- continua exigindo valor > 0 nos servicos pagos normais.
-- =============================================================================

alter table public.client_services
  add column is_partnership boolean not null default false;

alter table public.client_services
  alter column amount drop not null;

alter table public.client_services
  drop constraint client_services_amount_check;

alter table public.client_services
  add constraint client_services_amount_check check (
    (is_partnership and amount is null) or (not is_partnership and amount > 0)
  );
