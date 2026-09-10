-- =============================================================================
-- Colunas do Pix automatico (Mercado Pago) e da emissao de Nota Fiscal
-- (Focus NFe) -- ambas opcionais em qualquer cobranca, independentes do
-- metodo escolhido (uma cobranca 'mercadopago' sempre tem os campos MP; uma
-- cobranca de QUALQUER metodo pode emitir nota depois de paga).
-- =============================================================================

alter table public.invoices
  -- Mercado Pago: preenchido so quando method = 'mercadopago'.
  add column mercadopago_payment_id text,
  add column mercadopago_status text,
  add column mercadopago_qr_code text,
  add column mercadopago_qr_code_base64 text,
  -- Dados do pagador exigidos pra criar o Pix (CPF e obrigatorio na API do
  -- Mercado Pago) -- nao existiam em lugar nenhum do app ate agora.
  add column payer_name text,
  add column payer_cpf text,
  -- Nota fiscal (Focus NFe) -- independente do metodo de pagamento.
  add column nfe_status text check (nfe_status in ('pending', 'processing', 'issued', 'error')),
  add column nfe_ref text,
  add column nfe_number text,
  add column nfe_pdf_url text,
  add column nfe_error text;

create index invoices_mercadopago_payment_idx on public.invoices (mercadopago_payment_id)
  where mercadopago_payment_id is not null;
