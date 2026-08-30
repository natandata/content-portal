import type { Dictionary } from "@/lib/i18n/dictionary";
import type { UserRole } from "@/types/database";

export interface TourStep {
  /** Nome do icone lucide usado no card — resolvido no componente. */
  icon:
    | "wave"
    | "clients"
    | "content"
    | "approvals"
    | "documents"
    | "feed"
    | "chat"
    | "mural"
    | "platform"
    | "settings"
    | "check";
  title: string;
  body: string;
}

const STAFF_STEPS: TourStep[] = [
  {
    icon: "wave",
    title: "Bem-vindo ao Content Portal",
    body: "Em um minuto voce ve como o portal organiza o caminho do conteudo: do cliente ao contrato, do envio a aprovacao, ate a montagem do feed.",
  },
  {
    icon: "clients",
    title: "Clientes",
    body: "Cada cliente ganha um codigo de acesso de 7 caracteres. E com ele que a pessoa entra — sem senha, sem cadastro, sem email.",
  },
  {
    icon: "content",
    title: "Conteudos",
    body: "Envie imagem, video ou carrossel de ate 10 slides. Se o arquivo for pesado demais, use a aba Link e cole o endereco do Drive, WeTransfer ou OneDrive.",
  },
  {
    icon: "approvals",
    title: "Aprovacoes",
    body: "O cliente aprova, reprova ou pede alteracao — sempre com comentario. Tudo fica registrado no historico do conteudo, com data e autor.",
  },
  {
    icon: "documents",
    title: "Documentos",
    body: "Contrato, estrategia de conteudo, brandbook, mockup. So contrato pede devolucao assinada — e o cliente pode assinar pelo Gov.br quando voce habilitar; o resto ele so le e baixa.",
  },
  {
    icon: "feed",
    title: "Feed",
    body: "A grade de 3 x 10 simula o perfil do Instagram. Arraste para reorganizar e edite foto, nome, @, bio e destaques em Editar perfil.",
  },
  {
    icon: "chat",
    title: "Chat",
    body: "Fale direto com cada cliente. Da para anexar um link que leva a pessoa direto a um conteudo, aos documentos ou ao feed — util quando voce quer que ela veja algo especifico.",
  },
  {
    icon: "mural",
    title: "Mural",
    body: "Publique novidades sobre o que voce esta preparando para o portal. Todo mundo pode curtir ou nao curtir, e voce ve o resultado dos votos.",
  },
  {
    icon: "settings",
    title: "O numero ao lado do menu",
    body: "E pendencia de verdade, nao aviso: conta o que voltou do cliente e some sozinho quando voce resolve. O tema claro/escuro fica no rodape do menu.",
  },
];

const ADMIN_EXTRA: TourStep = {
  icon: "platform",
  title: "Plataforma",
  body: "So o administrador ve: quanto o banco e o armazenamento estao consumindo, o que ocupa cada espaco e a medicao semana a semana.",
};

const CLOSING: TourStep = {
  icon: "check",
  title: "Pronto para comecar",
  body: "Este tour aparece uma vez so. Se precisar rever alguma coisa, cada tela tem a explicacao do que faz logo abaixo do titulo.",
};

/**
 * Passos do cliente vem do dicionario (pt-BR/en) — e a unica parte do tour
 * traduzida, porque e a unica que o cliente ve. Staff continua fixo em
 * portugues.
 */
function clientSteps(dict: Dictionary): TourStep[] {
  const t = dict.tour.client;
  return [
    { icon: "wave", title: t.welcomeTitle, body: t.welcomeBody },
    { icon: "content", title: t.contentTitle, body: t.contentBody },
    { icon: "approvals", title: t.approveTitle, body: t.approveBody },
    { icon: "feed", title: t.feedTitle, body: t.feedBody },
    { icon: "documents", title: t.documentsTitle, body: t.documentsBody },
    { icon: "chat", title: t.chatTitle, body: t.chatBody },
    { icon: "mural", title: t.muralTitle, body: t.muralBody },
    { icon: "check", title: t.closingTitle, body: t.closingBody },
  ];
}

export function tourSteps(role: UserRole, dict: Dictionary): TourStep[] {
  if (role === "client") return clientSteps(dict);
  if (role === "admin") return [...STAFF_STEPS, ADMIN_EXTRA, CLOSING];
  return [...STAFF_STEPS, CLOSING];
}
