-- Botao "Assinar com Gov.br" no lado do cliente. So faz sentido quando o
-- documento pede assinatura; a constraint impede o estado contraditorio.
alter table public.contracts
  add column if not exists allow_gov_br_signature boolean not null default false;

alter table public.contracts
  drop constraint if exists contracts_gov_br_requires_signature;
alter table public.contracts
  add constraint contracts_gov_br_requires_signature check (
    not allow_gov_br_signature or requires_signature
  );
