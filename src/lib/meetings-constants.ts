/**
 * Caminho da tela de configuracao de reunioes — compartilhado entre a
 * integracao do Google Meet e a do Calendly, que vivem na mesma pagina (um
 * cartao cada). Fica fora de qualquer modulo "use server" porque esses so
 * podem exportar funcao assincrona, nunca uma constante.
 */
export const MEETINGS_SETTINGS_PATH = "/professional/settings/meetings";
