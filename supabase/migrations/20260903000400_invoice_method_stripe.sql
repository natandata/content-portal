-- =============================================================================
-- Novo metodo de cobranca: 'stripe'
--
-- Este arquivo tem uma instrucao so, de proposito. O Postgres nao deixa USAR um
-- valor de enum na mesma transacao que o adicionou, e cada arquivo de migracao
-- roda na propria transacao. As colunas e a constraint que citam 'stripe' vivem
-- na migracao seguinte.
--
-- Nao tem volta: `alter type ... add value` nao e reversivel. Empurrar para uma
-- branch do Supabase antes de producao.
-- =============================================================================

alter type public.invoice_method add value if not exists 'stripe';
