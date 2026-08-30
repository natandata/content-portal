import type { Locale } from "@/lib/i18n/locale";

export interface Dictionary {
  languageToggle: { brazilian: string; notBrazilian: string; label: string };
  login: {
    title: string;
    subtitle: string;
    tabStaff: string;
    tabClient: string;
    identifier: string;
    identifierPlaceholder: string;
    password: string;
    fillStaff: string;
    enter: string;
    accessCode: string;
    accessCodeHint: string;
    invalidCode: string;
    fillPassword: string;
    connectionError: string;
    adminAccess: string;
    adminOnlyUser: string;
    adminEnter: string;
    back: string;
    noAccess: string;
    request: string;
    footer: string;
  };
  accessRequest: {
    title: string;
    subtitle: string;
    name: string;
    email: string;
    password: string;
    passwordHint: string;
    note: string;
    noteHint: string;
    submit: string;
    successTitle: string;
    successBody: string;
    backToLogin: string;
  };
  curtain: { message: string };
  tour: {
    step1of: (current: number, total: number) => string;
    skip: string;
    close: string;
    back: string;
    next: string;
    start: string;
    client: {
      welcomeTitle: string;
      welcomeBody: string;
      contentTitle: string;
      contentBody: string;
      approveTitle: string;
      approveBody: string;
      feedTitle: string;
      feedBody: string;
      documentsTitle: string;
      documentsBody: string;
      chatTitle: string;
      chatBody: string;
      muralTitle: string;
      muralBody: string;
      closingTitle: string;
      closingBody: string;
    };
  };
  notifications: {
    promptTitle: string;
    promptBody: string;
    later: string;
    activate: string;
    settingsTitle: string;
    settingsHint: string;
    onThisDevice: string;
    offThisDevice: string;
    enable: string;
    disable: string;
    checking: string;
    unsupported: string;
    denied: string;
    enabledToast: string;
    disabledToast: string;
    enableError: string;
  };
  nav: {
    home: string;
    content: string;
    feed: string;
    documents: string;
    chat: string;
    settings: string;
  };
  dashboard: {
    hello: (name: string) => string;
    subtitle: string;
    awaitingYou: string;
    approved: string;
    inRevision: string;
    totalReceived: string;
    documentsCard: string;
    openDocuments: string;
    noDocuments: string;
    awaitingApprovalSection: string;
    seeAll: string;
    noPending: string;
  };
  content: {
    title: string;
    subtitle: string;
    empty: string;
    emptyBody: string;
    view: string;
    approve: string;
    reject: string;
    requestChange: string;
    whatToDo: string;
    caption: string;
    description: string;
    history: string;
    noScheduledDate: string;
    decidedNotice: string;
    draftNotice: string;
  };
  approval: {
    modalRequestTitle: string;
    modalRequestField: string;
    modalRequestPlaceholder: string;
    modalRejectTitle: string;
    modalRejectField: string;
    modalRejectPlaceholder: string;
    cancel: string;
    sendRequest: string;
    confirmReject: string;
    commentRequired: string;
    approvedToast: string;
    rejectedToast: string;
    revisionToast: string;
  };
  documents: {
    title: string;
    subtitle: string;
    empty: string;
    emptyBody: string;
    receivedOn: string;
    preview: string;
    previewTitle: string;
    download: string;
    downloadUnavailable: string;
    sendSigned: string;
    sendNewSigned: string;
    confirmSend: string;
    selectPdf: string;
    change: string;
    viewSigned: string;
    approvedNotice: string;
    signWithGovBr: string;
    govBrHint: string;
    openInNewTab: string;
    close: string;
  };
  feed: {
    title: string;
    subtitle: (companyName: string) => string;
    empty: string;
    emptyBody: string;
    positions: (count: number, max: number) => string;
    updatedOn: string;
    follow: string;
    message: string;
    posts: string;
    followers: string;
    following: string;
    noReels: string;
  };
  settings: {
    title: string;
    subtitle: string;
    appearance: string;
    appearanceHint: string;
    light: string;
    dark: string;
    system: string;
    notifications: string;
  };
  status: {
    content: {
      draft: string;
      submitted: string;
      awaiting_approval: string;
      approved: string;
      revision_requested: string;
      rejected: string;
      published: string;
    };
    document: {
      awaiting_signature: string;
      signed: string;
      under_review: string;
      approved: string;
      replaced: string;
      delivered: string;
    };
    documentKind: {
      contract: string;
      strategy: string;
      brandbook: string;
      mockup: string;
      other: string;
    };
  };
  common: {
    logout: string;
    loading: string;
  };
  contentType: {
    image: string;
    video: string;
    carousel: string;
    slide: string;
    slides: string;
  };
  media: {
    unavailable: string;
    hostedExternally: string;
    openLink: string;
    videoUnsupported: string;
    previousSlide: string;
    nextSlide: string;
    goToSlide: (n: number) => string;
    slideOf: (current: number, total: number) => string;
  };
  /**
   * `approval_history.action` e gravado em portugues pelo banco (RPC e server
   * actions) — nao muda por locale. Este mapa e so para EXIBIR ao cliente
   * ingles; frases fora dele aparecem como vieram, sem quebrar nada.
   */
  historyAction: Record<string, string>;
  history: { empty: string };
  feedPreview: {
    button: string;
    title: string;
    alreadyIn: string;
    preview: string;
    close: string;
    empty: string;
    newBadge: string;
  };
  chat: {
    title: string;
    subtitle: string;
    inboxEmpty: string;
    inboxEmptyBody: string;
    threadEmpty: string;
    placeholder: string;
    send: string;
    attachLink: string;
    linkTarget: string;
    linkTargetDashboard: string;
    linkTargetContent: string;
    linkTargetDocuments: string;
    linkTargetFeed: string;
    linkTargetContentPlaceholder: string;
    linkLabel: string;
    linkLabelPlaceholder: string;
    openLink: string;
    staffOnlyLink: string;
    cancel: string;
    back: string;
  };
  bulletin: {
    title: string;
    subtitle: string;
    dashboardTitle: string;
    empty: string;
    seeAll: string;
    like: string;
    dislike: string;
    newPost: string;
    editPost: string;
    postTitle: string;
    postBody: string;
    publish: string;
    published: string;
    draft: string;
    save: string;
    cancel: string;
    delete: string;
    confirmDelete: string;
    createdToast: string;
    updatedToast: string;
    deletedToast: string;
    reportTitle: string;
    reportEmpty: string;
    votersEmpty: string;
  };
}

const ptBR: Dictionary = {
  languageToggle: { brazilian: "Sou Brasileiro", notBrazilian: "I'm not Brazilian", label: "Idioma" },
  login: {
    title: "Content Portal",
    subtitle: "Acesse sua conta",
    tabStaff: "Sou Profissional",
    tabClient: "Sou Cliente",
    identifier: "Usuario ou email",
    identifierPlaceholder: "voce@empresa.com",
    password: "Senha",
    fillStaff: "Preencha usuario e senha.",
    enter: "Entrar",
    accessCode: "Codigo de acesso",
    accessCodeHint: "Seu gestor de conteudo enviou um codigo com 3 letras e 4 numeros.",
    invalidCode: "O codigo tem 3 letras e 4 numeros. Exemplo: ABC1234.",
    fillPassword: "Informe a senha do administrador.",
    connectionError: "Falha de conexao. Verifique sua internet e tente novamente.",
    adminAccess: "Acesso administrador",
    adminOnlyUser: "O usuario e sempre Admin. Informe a senha.",
    adminEnter: "Entrar como administrador",
    back: "Voltar",
    noAccess: "Ainda nao tem acesso?",
    request: "Solicitar",
    footer: "Plataforma privada. O acesso e individual e monitorado.",
  },
  accessRequest: {
    title: "Solicitar acesso",
    subtitle: "Um administrador vai revisar e liberar seu acesso.",
    name: "Nome",
    email: "Email",
    password: "Senha",
    passwordHint: "Minimo de 8 caracteres.",
    note: "Mensagem",
    noteHint: "Opcional — conte um pouco sobre voce.",
    submit: "Enviar solicitacao",
    successTitle: "Solicitacao enviada",
    successBody: "Voce podera entrar assim que o administrador aprovar o acesso.",
    backToLogin: "Voltar para o login",
  },
  curtain: { message: "Estamos organizando seus conteudos" },
  tour: {
    step1of: (c, t) => `${c} de ${t}`,
    skip: "Pular tour",
    close: "Fechar",
    back: "Voltar",
    next: "Proximo",
    start: "Comecar a usar",
    client: {
      welcomeTitle: "Bem-vindo ao seu portal",
      welcomeBody:
        "Aqui voce acompanha os conteudos que seu gestor preparou, aprova o que gostou e assina os documentos. Leva um minuto para conhecer.",
      contentTitle: "Conteudos",
      contentBody:
        "Cada post chega com imagem, legenda e data prevista. Abra para ver em tamanho grande antes de decidir.",
      approveTitle: "Aprovar, reprovar ou pedir alteracao",
      approveBody:
        "Se algo precisa mudar, escreva o que voce quer diferente. O comentario e obrigatorio nesses casos — e o que orienta a proxima versao.",
      feedTitle: "Feed",
      feedBody:
        "A previa mostra como seu perfil vai ficar com os posts na ordem planejada. E so visualizacao: a composicao quem monta e seu gestor.",
      documentsTitle: "Documentos",
      documentsBody:
        "Contrato, estrategia, brandbook. Da para ler na tela antes de baixar; quando o documento pedir assinatura, voce devolve o arquivo assinado por aqui.",
      chatTitle: "Chat",
      chatBody:
        "Fale direto com quem cuida do seu conteudo. As vezes a mensagem vem com um botao que leva voce direto para algo especifico no portal.",
      muralTitle: "Mural",
      muralBody:
        "Novidades sobre o que esta por vir no portal. De uma olhada e diga se gostou — seu voto ajuda a decidir o que vem a seguir.",
      closingTitle: "Pronto para comecar",
      closingBody:
        "Este tour aparece uma vez so. Se precisar rever alguma coisa, cada tela tem a explicacao do que faz logo abaixo do titulo.",
    },
  },
  notifications: {
    promptTitle: "Ativar notificacoes?",
    promptBody:
      "Avisamos na hora quando chegar conteudo para aprovar, documento para assinar ou resposta do cliente. Pode ligar ou desligar quando quiser em Configuracoes.",
    later: "Agora nao",
    activate: "Ativar notificacoes",
    settingsTitle: "Notificacoes",
    settingsHint: "Avisos de novo conteudo, documentos e retorno da equipe.",
    onThisDevice: "Ativadas neste aparelho",
    offThisDevice: "Desativadas neste aparelho",
    enable: "Ativar",
    disable: "Desativar",
    checking: "Verificando suporte do navegador...",
    unsupported:
      "Este navegador nao suporta notificacoes push. No iPhone, adicione o portal a tela de inicio primeiro — o Safari so libera notificacoes para apps instalados.",
    denied:
      "As notificacoes estao bloqueadas nas configuracoes do navegador para este site. Libere por la para poder ativar aqui.",
    enabledToast: "Notificacoes ativadas neste aparelho.",
    disabledToast: "Notificacoes desativadas neste aparelho.",
    enableError: "Nao foi possivel ativar. Verifique a permissao do navegador.",
  },
  nav: {
    home: "Inicio",
    content: "Conteudos",
    feed: "Feed",
    documents: "Documentos",
    chat: "Chat",
    settings: "Configuracoes",
  },
  dashboard: {
    hello: (name) => `Ola, ${name}`,
    subtitle: "Aqui estao os conteudos que aguardam a sua avaliacao.",
    awaitingYou: "Aguardando voce",
    approved: "Aprovados",
    inRevision: "Em alteracao",
    totalReceived: "Total recebido",
    documentsCard: "Documentos",
    openDocuments: "Abrir documentos",
    noDocuments: "Nenhum documento disponivel ate o momento.",
    awaitingApprovalSection: "Aguardando aprovacao",
    seeAll: "Ver todos",
    noPending: "Nada pendente por aqui.",
  },
  content: {
    title: "Conteudos",
    subtitle: "Tudo que seu gestor enviou para voce.",
    empty: "Nenhum conteudo disponivel ainda.",
    emptyBody: "Assim que a sua equipe enviar um conteudo, ele aparece aqui.",
    view: "Visualizar",
    approve: "Aprovar",
    reject: "Reprovar",
    requestChange: "Solicitar alteracao",
    whatToDo: "O que voce quer fazer?",
    caption: "Legenda",
    description: "Descricao",
    history: "Historico",
    noScheduledDate: "Sem data prevista",
    decidedNotice: "Este conteudo ja foi aprovado. Fale com seu gestor para reabrir a revisao.",
    draftNotice: "Este conteudo ainda esta em producao.",
  },
  approval: {
    modalRequestTitle: "Solicitar alteracao",
    modalRequestField: "O que precisa ser alterado?",
    modalRequestPlaceholder: "Ex.: trocar a foto do slide 2 e ajustar a legenda.",
    modalRejectTitle: "Reprovar conteudo",
    modalRejectField: "Por que esta reprovando?",
    modalRejectPlaceholder: "Explique o motivo para o profissional entender.",
    cancel: "Cancelar",
    sendRequest: "Enviar solicitacao",
    confirmReject: "Confirmar reprovacao",
    commentRequired: "Descreva o motivo para o profissional entender o que ajustar.",
    approvedToast: "Conteudo aprovado.",
    rejectedToast: "Conteudo reprovado.",
    revisionToast: "Alteracao solicitada.",
  },
  documents: {
    title: "Documentos",
    subtitle: "Contrato, estrategia, brandbook e o que mais seu gestor enviar.",
    empty: "Nenhum documento disponivel",
    emptyBody: "Assim que o seu gestor enviar algum documento, ele aparece aqui.",
    receivedOn: "Recebido em",
    preview: "Pre-visualizar",
    previewTitle: "Pre-visualizar documento",
    download: "Baixar documento",
    downloadUnavailable: "O arquivo ainda nao esta disponivel para download.",
    sendSigned: "Enviar documento assinado",
    sendNewSigned: "Enviar novo arquivo assinado",
    confirmSend: "Confirmar envio",
    selectPdf: "Selecione o PDF assinado.",
    change: "Trocar",
    viewSigned: "Ver o arquivo assinado que voce enviou",
    approvedNotice: "Documento conferido e aprovado pelo seu gestor.",
    signWithGovBr: "Assinar com Gov.br",
    govBrHint:
      "Abre o assinador oficial do governo em outra aba. Baixe o documento acima, assine por la com sua conta Gov.br e depois envie o arquivo assinado aqui embaixo.",
    openInNewTab: "Abrir em nova aba",
    close: "Fechar",
  },
  feed: {
    title: "Feed",
    subtitle: (name) => `Previa de como o perfil de ${name} vai ficar.`,
    empty: "Feed ainda vazio",
    emptyBody: "Seu gestor de conteudo esta montando a composicao do perfil.",
    positions: (count, max) => `${count} de ${max} posicoes`,
    updatedOn: "atualizado em",
    follow: "Seguir",
    message: "Mensagem",
    posts: "publicacoes",
    followers: "seguidores",
    following: "seguindo",
    noReels: "Nenhum reels na composicao ainda.",
  },
  settings: {
    title: "Configuracoes",
    subtitle: "Aparencia e notificacoes deste aparelho.",
    appearance: "Aparencia",
    appearanceHint:
      "Vale para este aparelho. Em 'Sistema' o app segue o tema do celular ou do computador.",
    light: "Claro",
    dark: "Escuro",
    system: "Sistema",
    notifications: "Notificacoes",
  },
  status: {
    content: {
      draft: "Rascunho",
      submitted: "Enviado",
      awaiting_approval: "Aguardando aprovacao",
      approved: "Aprovado",
      revision_requested: "Alteracao solicitada",
      rejected: "Reprovado",
      published: "Publicado",
    },
    document: {
      awaiting_signature: "Aguardando assinatura",
      signed: "Documento enviado",
      under_review: "Aguardando conferencia",
      approved: "Aprovado",
      replaced: "Substituido",
      delivered: "Entregue",
    },
    documentKind: {
      contract: "Contrato",
      strategy: "Estrategia de conteudo",
      brandbook: "Brandbook",
      mockup: "Mockup",
      other: "Outro documento",
    },
  },
  historyAction: {},
  history: { empty: "Nenhum movimento registrado ate agora." },
  feedPreview: {
    button: "Ver no feed",
    title: "Ver no feed",
    alreadyIn: "Este conteudo ja esta na composicao do feed.",
    preview: "Previa de como o perfil ficaria com este post publicado agora.",
    close: "Fechar",
    empty: "Nada no feed ainda.",
    newBadge: "novo",
  },
  common: { logout: "Sair", loading: "Carregando..." },
  contentType: { image: "Imagem", video: "Video", carousel: "Carrossel", slide: "slide", slides: "slides" },
  media: {
    unavailable: "Arquivo indisponivel",
    hostedExternally: "O arquivo esta hospedado fora do portal.",
    openLink: "Abrir link",
    videoUnsupported: "Seu navegador nao consegue reproduzir este video.",
    previousSlide: "Slide anterior",
    nextSlide: "Proximo slide",
    goToSlide: (n) => `Ir para o slide ${n}`,
    slideOf: (c, t) => `Slide ${c}/${t}`,
  },
  chat: {
    title: "Chat",
    subtitle: "Converse direto com quem cuida do seu conteudo.",
    inboxEmpty: "Nenhuma conversa ainda",
    inboxEmptyBody: "As conversas aparecem aqui assim que voce cadastrar um cliente.",
    threadEmpty: "Nenhuma mensagem ainda. Escreva a primeira.",
    placeholder: "Escreva uma mensagem...",
    send: "Enviar",
    attachLink: "Anexar link",
    linkTarget: "Para onde leva",
    linkTargetDashboard: "Inicio",
    linkTargetContent: "Um conteudo especifico",
    linkTargetDocuments: "Documentos",
    linkTargetFeed: "Feed",
    linkTargetContentPlaceholder: "Selecione o conteudo",
    linkLabel: "Texto do botao",
    linkLabelPlaceholder: "Ex.: Veja o novo post",
    openLink: "Abrir",
    staffOnlyLink: "Somente a equipe pode enviar um link.",
    cancel: "Cancelar",
    back: "Voltar",
  },
  bulletin: {
    title: "Mural de novidades",
    subtitle: "O que estamos preparando para o portal.",
    dashboardTitle: "Novidades",
    empty: "Nenhuma novidade publicada ainda.",
    seeAll: "Ver todas",
    like: "Gostei",
    dislike: "Nao gostei",
    newPost: "Nova novidade",
    editPost: "Editar novidade",
    postTitle: "Titulo",
    postBody: "Descricao",
    publish: "Publicada",
    published: "Publicada",
    draft: "Rascunho",
    save: "Salvar",
    cancel: "Cancelar",
    delete: "Excluir",
    confirmDelete: "Excluir esta novidade? Os votos tambem serao apagados.",
    createdToast: "Novidade criada.",
    updatedToast: "Novidade atualizada.",
    deletedToast: "Novidade excluida.",
    reportTitle: "Votos do mural",
    reportEmpty: "Nenhuma novidade publicada ainda.",
    votersEmpty: "Ninguem votou ainda.",
  },
};

const en: Dictionary = {
  languageToggle: { brazilian: "Sou Brasileiro", notBrazilian: "I'm not Brazilian", label: "Language" },
  login: {
    title: "Content Portal",
    subtitle: "Sign in to your account",
    tabStaff: "I'm Staff",
    tabClient: "I'm a Client",
    identifier: "Username or email",
    identifierPlaceholder: "you@company.com",
    password: "Password",
    fillStaff: "Enter your username and password.",
    enter: "Sign in",
    accessCode: "Access code",
    accessCodeHint: "Your content manager sent you a code with 3 letters and 4 numbers.",
    invalidCode: "The code has 3 letters and 4 numbers. Example: ABC1234.",
    fillPassword: "Enter the administrator password.",
    connectionError: "Connection failed. Check your internet and try again.",
    adminAccess: "Administrator access",
    adminOnlyUser: "The username is always Admin. Enter the password.",
    adminEnter: "Sign in as administrator",
    back: "Back",
    noAccess: "Don't have access yet?",
    request: "Request",
    footer: "Private platform. Access is individual and monitored.",
  },
  accessRequest: {
    title: "Request access",
    subtitle: "An administrator will review and grant your access.",
    name: "Name",
    email: "Email",
    password: "Password",
    passwordHint: "At least 8 characters.",
    note: "Message",
    noteHint: "Optional — tell us a bit about yourself.",
    submit: "Send request",
    successTitle: "Request sent",
    successBody: "You'll be able to sign in as soon as the administrator approves your access.",
    backToLogin: "Back to sign in",
  },
  curtain: { message: "Getting your content ready" },
  tour: {
    step1of: (c, t) => `${c} of ${t}`,
    skip: "Skip tour",
    close: "Close",
    back: "Back",
    next: "Next",
    start: "Start using it",
    client: {
      welcomeTitle: "Welcome to your portal",
      welcomeBody:
        "Here you track the content your manager prepared, approve what you like, and sign documents. Takes a minute to get to know it.",
      contentTitle: "Content",
      contentBody:
        "Each post arrives with an image, caption, and a planned date. Open it to see it full size before deciding.",
      approveTitle: "Approve, reject, or request a change",
      approveBody:
        "If something needs to change, write what you'd like different. A comment is required in that case — it's what guides the next version.",
      feedTitle: "Feed",
      feedBody:
        "The preview shows how your profile will look with the posts in the planned order. It's view-only: your manager builds the layout.",
      documentsTitle: "Documents",
      documentsBody:
        "Contract, strategy, brandbook. You can read it on screen before downloading; when a document needs a signature, you return the signed file right here.",
      chatTitle: "Chat",
      chatBody:
        "Message the person handling your content directly. Sometimes a message comes with a button that takes you straight to something specific in the portal.",
      muralTitle: "Updates board",
      muralBody:
        "News about what's coming to the portal. Take a look and let us know if you like it — your vote helps decide what comes next.",
      closingTitle: "Ready to get started",
      closingBody:
        "This tour only shows up once. If you need a reminder, every screen has a short explanation right below its title.",
    },
  },
  notifications: {
    promptTitle: "Turn on notifications?",
    promptBody:
      "We'll let you know right away when there's content to approve, a document to sign, or a reply from your client. Turn it on or off anytime in Settings.",
    later: "Not now",
    activate: "Turn on notifications",
    settingsTitle: "Notifications",
    settingsHint: "Alerts for new content, documents, and team replies.",
    onThisDevice: "On for this device",
    offThisDevice: "Off for this device",
    enable: "Turn on",
    disable: "Turn off",
    checking: "Checking browser support...",
    unsupported:
      "This browser doesn't support push notifications. On iPhone, add the portal to your home screen first — Safari only allows notifications for installed apps.",
    denied:
      "Notifications are blocked in this browser's settings for this site. Unblock them there to turn this on.",
    enabledToast: "Notifications turned on for this device.",
    disabledToast: "Notifications turned off for this device.",
    enableError: "Couldn't turn it on. Check your browser's notification permission.",
  },
  nav: {
    home: "Home",
    content: "Content",
    feed: "Feed",
    documents: "Documents",
    chat: "Chat",
    settings: "Settings",
  },
  dashboard: {
    hello: (name) => `Hi, ${name}`,
    subtitle: "Here's the content waiting for your review.",
    awaitingYou: "Awaiting you",
    approved: "Approved",
    inRevision: "In revision",
    totalReceived: "Total received",
    documentsCard: "Documents",
    openDocuments: "Open documents",
    noDocuments: "No documents available yet.",
    awaitingApprovalSection: "Awaiting approval",
    seeAll: "See all",
    noPending: "Nothing pending here.",
  },
  content: {
    title: "Content",
    subtitle: "Everything your manager has sent you.",
    empty: "No content available yet.",
    emptyBody: "As soon as your team sends content, it'll show up here.",
    view: "View",
    approve: "Approve",
    reject: "Reject",
    requestChange: "Request change",
    whatToDo: "What would you like to do?",
    caption: "Caption",
    description: "Description",
    history: "History",
    noScheduledDate: "No scheduled date",
    decidedNotice: "This content has already been approved. Talk to your manager to reopen the review.",
    draftNotice: "This content is still in production.",
  },
  approval: {
    modalRequestTitle: "Request a change",
    modalRequestField: "What needs to change?",
    modalRequestPlaceholder: "E.g.: swap the photo on slide 2 and adjust the caption.",
    modalRejectTitle: "Reject content",
    modalRejectField: "Why are you rejecting it?",
    modalRejectPlaceholder: "Explain the reason so the professional understands.",
    cancel: "Cancel",
    sendRequest: "Send request",
    confirmReject: "Confirm rejection",
    commentRequired: "Describe the reason so the professional knows what to fix.",
    approvedToast: "Content approved.",
    rejectedToast: "Content rejected.",
    revisionToast: "Change requested.",
  },
  documents: {
    title: "Documents",
    subtitle: "Contract, strategy, brandbook, and anything else your manager sends.",
    empty: "No documents available",
    emptyBody: "As soon as your manager sends a document, it'll show up here.",
    receivedOn: "Received on",
    preview: "Preview",
    previewTitle: "Preview document",
    download: "Download document",
    downloadUnavailable: "The file isn't available for download yet.",
    sendSigned: "Send signed document",
    sendNewSigned: "Send a new signed file",
    confirmSend: "Confirm submission",
    selectPdf: "Select the signed PDF.",
    change: "Change",
    viewSigned: "View the signed file you sent",
    approvedNotice: "Document reviewed and approved by your manager.",
    signWithGovBr: "Sign with Gov.br",
    govBrHint:
      "Opens the Brazilian government's official signing tool in another tab. Download the document above, sign it there with your Gov.br account, then send the signed file back down here.",
    openInNewTab: "Open in new tab",
    close: "Close",
  },
  feed: {
    title: "Feed",
    subtitle: (name) => `Preview of how ${name}'s profile will look.`,
    empty: "Feed still empty",
    emptyBody: "Your content manager is putting the profile layout together.",
    positions: (count, max) => `${count} of ${max} spots`,
    updatedOn: "updated on",
    follow: "Follow",
    message: "Message",
    posts: "posts",
    followers: "followers",
    following: "following",
    noReels: "No reels in the layout yet.",
  },
  settings: {
    title: "Settings",
    subtitle: "Appearance and notifications for this device.",
    appearance: "Appearance",
    appearanceHint: "Applies to this device. On 'System', the app follows your phone or computer theme.",
    light: "Light",
    dark: "Dark",
    system: "System",
    notifications: "Notifications",
  },
  status: {
    content: {
      draft: "Draft",
      submitted: "Submitted",
      awaiting_approval: "Awaiting approval",
      approved: "Approved",
      revision_requested: "Change requested",
      rejected: "Rejected",
      published: "Published",
    },
    document: {
      awaiting_signature: "Awaiting signature",
      signed: "Document sent",
      under_review: "Under review",
      approved: "Approved",
      replaced: "Replaced",
      delivered: "Delivered",
    },
    documentKind: {
      contract: "Contract",
      strategy: "Content strategy",
      brandbook: "Brandbook",
      mockup: "Mockup",
      other: "Other document",
    },
  },
  historyAction: {
    "Conteudo enviado para aprovacao": "Content sent for approval",
    "Conteudo marcado como publicado": "Content marked as published",
    "Profissional atualizou o conteudo": "Professional updated the content",
    "Cliente aprovou o conteudo": "Client approved the content",
    "Cliente reprovou o conteudo": "Client rejected the content",
    "Cliente solicitou alteracao": "Client requested a change",
  },
  history: { empty: "No activity recorded yet." },
  feedPreview: {
    button: "View in feed",
    title: "View in feed",
    alreadyIn: "This content is already part of the feed layout.",
    preview: "Preview of how the profile would look with this post published now.",
    close: "Close",
    empty: "Nothing in the feed yet.",
    newBadge: "new",
  },
  common: { logout: "Sign out", loading: "Loading..." },
  contentType: { image: "Image", video: "Video", carousel: "Carousel", slide: "slide", slides: "slides" },
  media: {
    unavailable: "File unavailable",
    hostedExternally: "This file is hosted outside the portal.",
    openLink: "Open link",
    videoUnsupported: "Your browser can't play this video.",
    previousSlide: "Previous slide",
    nextSlide: "Next slide",
    goToSlide: (n) => `Go to slide ${n}`,
    slideOf: (c, t) => `Slide ${c}/${t}`,
  },
  chat: {
    title: "Chat",
    subtitle: "Talk directly with the person handling your content.",
    inboxEmpty: "No conversations yet",
    inboxEmptyBody: "Conversations show up here once you register a client.",
    threadEmpty: "No messages yet. Write the first one.",
    placeholder: "Write a message...",
    send: "Send",
    attachLink: "Attach link",
    linkTarget: "Where it leads",
    linkTargetDashboard: "Home",
    linkTargetContent: "A specific piece of content",
    linkTargetDocuments: "Documents",
    linkTargetFeed: "Feed",
    linkTargetContentPlaceholder: "Select the content",
    linkLabel: "Button text",
    linkLabelPlaceholder: "E.g.: Check out the new post",
    openLink: "Open",
    staffOnlyLink: "Only the team can send a link.",
    cancel: "Cancel",
    back: "Back",
  },
  bulletin: {
    title: "Updates board",
    subtitle: "What we're preparing for the portal.",
    dashboardTitle: "Updates",
    empty: "No updates published yet.",
    seeAll: "See all",
    like: "Like",
    dislike: "Dislike",
    newPost: "New update",
    editPost: "Edit update",
    postTitle: "Title",
    postBody: "Description",
    publish: "Published",
    published: "Published",
    draft: "Draft",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirmDelete: "Delete this update? Votes will be deleted too.",
    createdToast: "Update created.",
    updatedToast: "Update saved.",
    deletedToast: "Update deleted.",
    reportTitle: "Board votes",
    reportEmpty: "No updates published yet.",
    votersEmpty: "No one has voted yet.",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { "pt-BR": ptBR, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
