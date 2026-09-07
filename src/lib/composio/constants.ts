/**
 * Constante compartilhada entre a action que inicia a conexao do Instagram
 * (via Composio) e a rota de callback. Fica fora de instagram-connect.ts
 * (que e "use server") porque um modulo "use server" so pode exportar
 * funcao assincrona — nenhuma constante. Mesmo padrao de
 * `CALENDLY_OAUTH_STATE_COOKIE`.
 *
 * Guarda um JSON `{connectionId, label}` — `connectionId` e o que a Composio
 * devolveu ao iniciar (nao um state de CSRF comum), unico jeito de saber no
 * callback qual conexao confirmar (a Composio so manda `status=success|failed`
 * de volta, sem o id); `label` e o apelido opcional que a pessoa digitou ao
 * conectar, repassado para a linha nova em `client_instagram_connections`.
 */
export const INSTAGRAM_CONNECT_COOKIE = "composio-instagram-connection";
