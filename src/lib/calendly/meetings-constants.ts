/**
 * Constante compartilhada entre a action que inicia a conexao do Calendly e
 * a rota de callback. Fica fora de calendly-connect.ts (que e "use server")
 * porque um modulo "use server" so pode exportar funcao assincrona — nenhuma
 * constante.
 */
export const CALENDLY_OAUTH_STATE_COOKIE = "calendly-oauth-state";
