/**
 * Constantes compartilhadas entre a action que inicia a conexao e a rota de
 * callback. Ficam fora de google-connect.ts (que e "use server") porque um
 * modulo "use server" so pode exportar funcao assincrona — nenhuma constante.
 */
export const GOOGLE_OAUTH_STATE_COOKIE = "google-oauth-state";
export const GOOGLE_MEETINGS_PATH = "/professional/settings/meetings";
