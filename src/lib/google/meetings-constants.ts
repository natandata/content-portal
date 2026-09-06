/**
 * Constante compartilhada entre a action que inicia a conexao do Google e a
 * rota de callback. Fica fora de google-connect.ts (que e "use server")
 * porque um modulo "use server" so pode exportar funcao assincrona — nenhuma
 * constante.
 */
export const GOOGLE_OAUTH_STATE_COOKIE = "google-oauth-state";
