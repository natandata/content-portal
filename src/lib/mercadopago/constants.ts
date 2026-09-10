/**
 * Constante compartilhada entre a action que inicia a conexao do Mercado
 * Pago e a rota de callback. Fica fora de mercadopago-connect.ts (que e
 * "use server") porque um modulo "use server" so pode exportar funcao
 * assincrona -- nenhuma constante. Mesmo desenho de
 * `lib/calendly/meetings-constants.ts`.
 */
export const MERCADOPAGO_OAUTH_STATE_COOKIE = "mercadopago-oauth-state";
