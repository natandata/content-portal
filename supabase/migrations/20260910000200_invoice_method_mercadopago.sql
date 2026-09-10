-- =============================================================================
-- Novo metodo de cobranca: 'mercadopago' (Pix automatico, sem staff confirmar
-- pagamento na mao -- o webhook do Mercado Pago fecha a cobranca sozinho).
--
-- Mesma regra do arquivo que adicionou 'stripe': uma instrucao so, porque o
-- Postgres nao deixa USAR um valor de enum na mesma transacao que o
-- adicionou. As colunas ficam na proxima migracao.
-- =============================================================================

alter type public.invoice_method add value if not exists 'mercadopago';
