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
    body: "Contrato, estrategia de conteudo, brandbook, mockup. So contrato pede devolucao assinada; o resto o cliente apenas le e baixa.",
  },
  {
    icon: "feed",
    title: "Feed",
    body: "A grade de 3 x 10 simula o perfil do Instagram. Arraste para reorganizar e edite foto, nome, @, bio e destaques em Editar perfil.",
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

const CLIENT_STEPS: TourStep[] = [
  {
    icon: "wave",
    title: "Bem-vindo ao seu portal",
    body: "Aqui voce acompanha os conteudos que seu gestor preparou, aprova o que gostou e assina os documentos. Leva um minuto para conhecer.",
  },
  {
    icon: "content",
    title: "Conteudos",
    body: "Cada post chega com imagem, legenda e data prevista. Abra para ver em tamanho grande antes de decidir.",
  },
  {
    icon: "approvals",
    title: "Aprovar, reprovar ou pedir alteracao",
    body: "Se algo precisa mudar, escreva o que voce quer diferente. O comentario e obrigatorio nesses casos — e o que orienta a proxima versao.",
  },
  {
    icon: "feed",
    title: "Feed",
    body: "A previa mostra como seu perfil vai ficar com os posts na ordem planejada. E so visualizacao: a composicao quem monta e seu gestor.",
  },
  {
    icon: "documents",
    title: "Documentos",
    body: "Contrato, estrategia, brandbook. Da para ler na tela antes de baixar; quando o documento pedir assinatura, voce devolve o arquivo assinado por aqui.",
  },
  CLOSING,
];

export function tourSteps(role: UserRole): TourStep[] {
  if (role === "client") return CLIENT_STEPS;
  if (role === "admin") return [...STAFF_STEPS, ADMIN_EXTRA, CLOSING];
  return [...STAFF_STEPS, CLOSING];
}
