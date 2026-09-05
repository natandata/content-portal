import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { FeedEntry } from "@/components/feed/feed-grid";
import type { ProfileView } from "@/components/feed/instagram-profile";
import { BUCKETS } from "@/lib/paths";
import { signedUrl, signedUrlMap } from "@/lib/storage";
import { AWAITING_CLIENT_STATUSES, NEEDS_TEAM_ACTION_STATUSES } from "@/lib/domain";
import type {
  BulletinAdminReportRow,
  BulletinFeedRow,
  ClientActivityRow,
  ClientServiceRow,
  ClientStatus,
  ContentFileRow,
  ContentRow,
  ContentStatus,
  ContractStatus,
  CurrencyCode,
  Database,
  PlatformStats,
  UserRole,
} from "@/types/database";

type Client = SupabaseClient<Database>;

export interface ContentCardData {
  content: ContentRow;
  clientName: string;
  fileCount: number;
  previewUrl: string | null;
}

export interface ContentFileWithUrl extends ContentFileRow {
  url: string | null;
  thumbnailUrl: string | null;
}

/** Primeiro arquivo de cada conteudo, usado como capa nas listagens e no feed. */
export async function loadContentPreviews(
  supabase: Client,
  contentIds: string[],
): Promise<Map<string, string | null>> {
  const previews = new Map<string, string | null>();
  if (contentIds.length === 0) return previews;

  const { data: files } = await supabase
    .from("content_files")
    .select("content_id, file_path, thumbnail_path, file_type, position")
    .in("content_id", contentIds)
    .eq("position", 1);

  if (!files || files.length === 0) return previews;

  const thumbPaths = files
    .map((file) => file.thumbnail_path)
    .filter((path): path is string => Boolean(path));

  // Link externo nao tem o que assinar: a capa fica vazia e a lista mostra o
  // placeholder do tipo.
  const imagePaths = files
    .filter((file) => !file.thumbnail_path && file.file_type.startsWith("image/"))
    .map((file) => file.file_path)
    .filter((path): path is string => Boolean(path));

  const [thumbUrls, imageUrls] = await Promise.all([
    signedUrlMap(supabase, BUCKETS.thumbnails, thumbPaths),
    signedUrlMap(supabase, BUCKETS.content, imagePaths),
  ]);

  for (const file of files) {
    const url = file.thumbnail_path
      ? (thumbUrls.get(file.thumbnail_path) ?? null)
      : file.file_path
        ? (imageUrls.get(file.file_path) ?? null)
        : null;
    previews.set(file.content_id, url);
  }

  return previews;
}

export async function loadContentFileCounts(
  supabase: Client,
  contentIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (contentIds.length === 0) return counts;

  const { data } = await supabase
    .from("content_files")
    .select("content_id")
    .in("content_id", contentIds);

  for (const row of data ?? []) {
    counts.set(row.content_id, (counts.get(row.content_id) ?? 0) + 1);
  }

  return counts;
}

/** Todos os arquivos de um conteudo, com URLs assinadas prontas para exibicao. */
export async function loadContentFiles(
  supabase: Client,
  contentId: string,
): Promise<ContentFileWithUrl[]> {
  const { data: files } = await supabase
    .from("content_files")
    .select("*")
    .eq("content_id", contentId)
    .order("position");

  if (!files || files.length === 0) return [];

  const [fileUrls, thumbUrls] = await Promise.all([
    signedUrlMap(
      supabase,
      BUCKETS.content,
      files.map((file) => file.file_path),
    ),
    signedUrlMap(
      supabase,
      BUCKETS.thumbnails,
      files.map((file) => file.thumbnail_path),
    ),
  ]);

  return files.map((file) => ({
    ...file,
    // O link externo e a propria URL; nao passa pelo Storage.
    url: file.external_url ?? (file.file_path ? (fileUrls.get(file.file_path) ?? null) : null),
    thumbnailUrl: file.thumbnail_path ? (thumbUrls.get(file.thumbnail_path) ?? null) : null,
  }));
}

export interface DashboardStats {
  activeClients: number;
  pendingContents: number;
  awaitingClient: number;
  approved: number;
}

export interface RevenueForecastRow {
  currency: CurrencyCode;
  amount: number;
}

/**
 * Soma das cobrancas com vencimento no mes corrente — aberta ou paga, o que
 * importa e o que esta previsto para cair naquele mes. RLS ja restringe as
 * linhas aos clientes que quem chamou enxerga (o profissional so ve as
 * proprias, o admin ve todas).
 */
export async function loadMonthlyRevenueForecast(supabase: Client): Promise<RevenueForecastRow[]> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("invoices")
    .select("amount, currency")
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd);

  const byCurrency = new Map<CurrencyCode, number>();
  for (const row of data ?? []) {
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + Number(row.amount));
  }

  return Array.from(byCurrency.entries()).map(([currency, amount]) => ({ currency, amount }));
}

export async function loadDashboardStats(supabase: Client): Promise<DashboardStats> {
  const awaitingClientStatuses: ContentStatus[] = ["submitted", "awaiting_approval"];
  const pendingStatuses: ContentStatus[] = [
    "draft",
    "submitted",
    "awaiting_approval",
    "revision_requested",
    "rejected",
  ];

  const [clients, pending, awaiting, approved] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("contents")
      .select("id", { count: "exact", head: true })
      .in("status", pendingStatuses),
    supabase
      .from("contents")
      .select("id", { count: "exact", head: true })
      .in("status", awaitingClientStatuses),
    supabase
      .from("contents")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "published"] satisfies ContentStatus[]),
  ]);

  return {
    activeClients: clients.count ?? 0,
    pendingContents: pending.count ?? 0,
    awaitingClient: awaiting.count ?? 0,
    approved: approved.count ?? 0,
  };
}

export interface AdminDashboardStats {
  activeClients: number;
  activeProfessionals: number;
  approvedContents: number;
  storageBytes: number;
  paidRevenue: { currency: CurrencyCode; amount: number }[];
}

/**
 * Dashboard do admin: visao de como os profissionais estao usando o app, nao
 * de um cliente especifico — por isso nao repete os contadores de conteudo
 * pendente/aguardando do dashboard do profissional.
 */
export async function loadAdminDashboardStats(supabase: Client): Promise<AdminDashboardStats> {
  const [clients, professionals, approvedContents, platform, paidInvoices] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "professional")
      .eq("status", "active"),
    supabase
      .from("contents")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "published"] satisfies ContentStatus[]),
    supabase.rpc("platform_stats"),
    supabase.from("invoices").select("currency, amount").eq("status", "paid"),
  ]);

  const revenueByCurrency = new Map<CurrencyCode, number>();
  for (const row of paidInvoices.data ?? []) {
    revenueByCurrency.set(
      row.currency,
      (revenueByCurrency.get(row.currency) ?? 0) + Number(row.amount),
    );
  }

  return {
    activeClients: clients.count ?? 0,
    activeProfessionals: professionals.count ?? 0,
    approvedContents: approvedContents.count ?? 0,
    storageBytes: (platform.data as PlatformStats | null)?.storage_bytes ?? 0,
    paidRevenue: Array.from(revenueByCurrency.entries()).map(([currency, amount]) => ({
      currency,
      amount,
    })),
  };
}

/**
 * Ids dos clientes de um profissional — usado pelo admin para filtrar
 * Conteudos/Aprovacoes/Documentos/Cobrancas/Feed a partir de Profissionais.
 */
export async function loadProfessionalClientIds(
  supabase: Client,
  professionalId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("professional_id", professionalId);
  return (data ?? []).map((row) => row.id);
}

/** Aparece como "cliente parado" so depois de tanto tempo sem nenhum toque. */
const STALE_ACTIVITY_DAYS = 30;

export interface ClientGalleryRow {
  id: string;
  companyName: string;
  name: string;
  accessCode: string;
  status: ClientStatus;
  /** Mesma imagem exibida no card e no topo da tela do cliente. */
  coverUrl: string | null;
  /** Ancoragem vertical do recorte (0 = topo, 50 = centro, 100 = base). */
  coverPositionY: number;
  /** Chave da paleta em lib/cover-palette.ts. */
  coverColor: string;
  /** Foto de perfil — vem de `client_profiles`, editavel pelo cliente ou pela equipe. */
  avatarUrl: string | null;
  /** @handle exibido no card: `client_profiles.username` ou derivado do nome. */
  handle: string;
  /** Etiqueta livre (segmento/nicho), se cadastrada. */
  tag: string | null;
  /** Conteudos aguardando decisao do cliente (submitted/awaiting_approval). */
  pendingApprovalCount: number;
  /** Tem conteudo com alteracao solicitada ou reprovado, esperando a equipe. */
  needsAdjustment: boolean;
  /** Tem cobranca em aberto com vencimento no passado. */
  overdueInvoice: boolean;
  /** Cliente antigo (30+ dias) sem nenhum conteudo ou atividade nos ultimos 30 dias. */
  staleActivity: boolean;
  /** Contagem por status, para o card (rascunho / ajuste / aguardando aprovacao / aprovados). */
  contentCounts: { draft: number; adjustment: number; awaitingApproval: number; approved: number };
}

/** "@handle" de exibicao a partir do nome de contato — so cosmetico, nunca usado para auth. */
function handleFromName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos ja separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `@${slug || "cliente"}`;
}

/**
 * Clientes com os sinais usados pela galeria (Por status / Atencao): conteudo
 * pendente, ajuste pedido, cobranca vencida e inatividade prolongada. Calcula
 * tudo em memoria a partir de poucas queries em lote — a base de clientes por
 * profissional e pequena o bastante para isso ser mais simples que um RPC.
 */
export async function loadClientsGallery(
  supabase: Client,
  options: { professionalId?: string } = {},
): Promise<ClientGalleryRow[]> {
  let clientsQuery = supabase.from("clients").select("*").order("company_name");
  if (options.professionalId) clientsQuery = clientsQuery.eq("professional_id", options.professionalId);
  const { data: clients } = await clientsQuery;
  const rows = clients ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((client) => client.id);
  const todayIso = new Date().toISOString().slice(0, 10);
  const staleThreshold = new Date(
    Date.now() - STALE_ACTIVITY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [{ data: contents }, { data: overdueInvoices }, { data: activities }, { data: profiles }, coverUrls] =
    await Promise.all([
      supabase.from("contents").select("client_id, status, updated_at").in("client_id", ids),
      supabase
        .from("invoices")
        .select("client_id")
        .in("client_id", ids)
        .eq("status", "open")
        .lt("due_date", todayIso),
      supabase
        .from("client_activities")
        .select("client_id, created_at")
        .in("client_id", ids)
        .order("created_at", { ascending: false }),
      supabase.from("client_profiles").select("client_id, username, avatar_path").in("client_id", ids),
      signedUrlMap(
        supabase,
        BUCKETS.profiles,
        rows.map((client) => client.cover_path),
      ),
    ]);

  const avatarUrls = await signedUrlMap(
    supabase,
    BUCKETS.profiles,
    (profiles ?? []).map((profile) => profile.avatar_path),
  );

  const pendingByClient = new Map<string, number>();
  const adjustmentByClient = new Set<string>();
  const lastContentByClient = new Map<string, string>();
  const contentCountsByClient = new Map<
    string,
    { draft: number; adjustment: number; awaitingApproval: number; approved: number }
  >();

  for (const row of contents ?? []) {
    const status = row.status as ContentStatus;
    if (AWAITING_CLIENT_STATUSES.includes(status)) {
      pendingByClient.set(row.client_id, (pendingByClient.get(row.client_id) ?? 0) + 1);
    }
    if (NEEDS_TEAM_ACTION_STATUSES.includes(status)) {
      adjustmentByClient.add(row.client_id);
    }
    const current = lastContentByClient.get(row.client_id);
    if (!current || row.updated_at > current) lastContentByClient.set(row.client_id, row.updated_at);

    const counts = contentCountsByClient.get(row.client_id) ?? {
      draft: 0,
      adjustment: 0,
      awaitingApproval: 0,
      approved: 0,
    };
    if (status === "draft") counts.draft += 1;
    else if (NEEDS_TEAM_ACTION_STATUSES.includes(status)) counts.adjustment += 1;
    else if (AWAITING_CLIENT_STATUSES.includes(status)) counts.awaitingApproval += 1;
    else if (status === "approved" || status === "published") counts.approved += 1;
    contentCountsByClient.set(row.client_id, counts);
  }

  const overdueSet = new Set((overdueInvoices ?? []).map((row) => row.client_id));

  const lastActivityByClient = new Map<string, string>();
  for (const row of activities ?? []) {
    if (!lastActivityByClient.has(row.client_id)) lastActivityByClient.set(row.client_id, row.created_at);
  }

  const profileByClient = new Map((profiles ?? []).map((profile) => [profile.client_id, profile]));

  return rows.map((client) => {
    const lastTouch = [lastContentByClient.get(client.id), lastActivityByClient.get(client.id)]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    const clientIsOldEnough = client.created_at < staleThreshold;
    const staleActivity = clientIsOldEnough && (!lastTouch || lastTouch < staleThreshold);
    const profile = profileByClient.get(client.id);

    return {
      id: client.id,
      companyName: client.company_name,
      name: client.name,
      accessCode: client.access_code,
      coverColor: client.cover_color,
      avatarUrl: profile?.avatar_path ? (avatarUrls.get(profile.avatar_path) ?? null) : null,
      handle: profile?.username ? `@${profile.username}` : handleFromName(client.name),
      tag: client.tag,
      contentCounts: contentCountsByClient.get(client.id) ?? {
        draft: 0,
        adjustment: 0,
        awaitingApproval: 0,
        approved: 0,
      },
      status: client.status,
      coverUrl: client.cover_path ? (coverUrls.get(client.cover_path) ?? null) : null,
      coverPositionY: client.cover_position_y,
      pendingApprovalCount: pendingByClient.get(client.id) ?? 0,
      needsAdjustment: adjustmentByClient.has(client.id),
      overdueInvoice: overdueSet.has(client.id),
      staleActivity,
    };
  });
}

/** Mapa id -> nome de empresa, para as listagens que cruzam clientes. */
export async function loadClientNames(
  supabase: Client,
  clientIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (clientIds.length === 0) return names;

  const { data } = await supabase
    .from("clients")
    .select("id, company_name")
    .in("id", Array.from(new Set(clientIds)));

  for (const row of data ?? []) names.set(row.id, row.company_name);
  return names;
}

/**
 * Cabecalho do perfil para a simulacao do feed. Devolve valores prontos para
 * exibir mesmo quando o cliente ainda nao tem perfil salvo.
 */
export async function loadProfileView(
  supabase: Client,
  clientId: string,
  fallbackName: string,
  realPostCount: number,
): Promise<ProfileView> {
  const [{ data: profile }, { data: highlights }] = await Promise.all([
    supabase.from("client_profiles").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("profile_highlights")
      .select("*")
      .eq("client_id", clientId)
      .order("position"),
  ]);

  const rows = highlights ?? [];

  const [avatarUrl, coverUrls] = await Promise.all([
    signedUrl(supabase, BUCKETS.profiles, profile?.avatar_path),
    signedUrlMap(
      supabase,
      BUCKETS.profiles,
      rows.map((row) => row.cover_path),
    ),
  ]);

  return {
    displayName: profile?.display_name ?? "",
    username: profile?.username ?? "",
    bio: profile?.bio ?? "",
    avatarUrl,
    // posts_count nulo = espelha a composicao real do feed.
    postsCount: profile?.posts_count ?? realPostCount,
    postsCountIsAuto: profile?.posts_count === null || profile?.posts_count === undefined,
    followersCount: profile?.followers_count ?? 0,
    followingCount: profile?.following_count ?? 0,
    showReelsTab: profile?.show_reels_tab ?? true,
    highlights: rows.map((row) => ({
      id: row.id,
      title: row.title,
      coverUrl: row.cover_path ? (coverUrls.get(row.cover_path) ?? null) : null,
    })),
  };
}

/** Dados crus do perfil, para preencher o editor da equipe. */
export async function loadProfileForm(supabase: Client, clientId: string) {
  const [{ data: profile }, { data: highlights }] = await Promise.all([
    supabase.from("client_profiles").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("profile_highlights")
      .select("*")
      .eq("client_id", clientId)
      .order("position"),
  ]);

  const rows = highlights ?? [];
  const coverUrls = await signedUrlMap(
    supabase,
    BUCKETS.profiles,
    rows.map((row) => row.cover_path),
  );
  const avatarUrl = await signedUrl(supabase, BUCKETS.profiles, profile?.avatar_path);

  return {
    profile: profile ?? null,
    avatarUrl,
    highlights: rows.map((row) => ({
      id: row.id,
      title: row.title,
      coverPath: row.cover_path,
      coverUrl: row.cover_path ? (coverUrls.get(row.cover_path) ?? null) : null,
    })),
  };
}

/**
 * Contadores do menu. Sao pendencias reais, nao "nao lidos": cada numero conta
 * itens que ainda esperam uma acao de quem esta olhando, entao ele zera sozinho
 * quando a pessoa faz o que tem que ser feito — sem tabela de leitura.
 */
export interface NavBadges {
  approvals: number;
  contracts: number;
  chat: number;
  invoices: number;
}

/**
 * Equipe: o cliente respondeu (ou devolveu o contrato) e a bola voltou.
 *
 * O badge "Chat" muda de sentido por papel: o admin so conversa com
 * profissionais (unread_staff_chat_count); o profissional conversa com
 * clientes e tambem com o admin, entao o numero soma os dois.
 */
export async function loadStaffBadges(supabase: Client, role: UserRole): Promise<NavBadges> {
  const answered: ContentStatus[] = ["approved", "revision_requested", "rejected"];
  const returned: ContractStatus[] = ["signed", "under_review"];

  const [contents, contracts, chat, invoices, staffChat] = await Promise.all([
    supabase
      .from("contents")
      .select("id", { count: "exact", head: true })
      .in("status", answered),
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .in("status", returned),
    supabase.rpc("unread_chat_count"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.rpc("unread_staff_chat_count"),
  ]);

  const chatCount =
    role === "admin" ? (staffChat.data ?? 0) : (chat.data ?? 0) + (staffChat.data ?? 0);

  return {
    approvals: contents.count ?? 0,
    contracts: contracts.count ?? 0,
    chat: chatCount,
    invoices: invoices.count ?? 0,
  };
}

/** Cliente: o que chegou para ele decidir ou assinar. */
export async function loadClientBadges(supabase: Client): Promise<NavBadges> {
  const waiting: ContentStatus[] = ["submitted", "awaiting_approval"];

  const [contents, contracts, chat, invoices] = await Promise.all([
    supabase
      .from("contents")
      .select("id", { count: "exact", head: true })
      .in("status", waiting),
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "awaiting_signature" satisfies ContractStatus),
    supabase.rpc("unread_chat_count"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return {
    approvals: contents.count ?? 0,
    contracts: contracts.count ?? 0,
    chat: chat.data ?? 0,
    invoices: invoices.count ?? 0,
  };
}

/** Itens do feed de um cliente, ja com capa assinada, na ordem publicada. */
export async function loadFeedEntries(
  supabase: Client,
  clientId: string,
): Promise<FeedEntry[]> {
  const { data: items } = await supabase
    .from("feed_items")
    .select("id, content_id, position")
    .eq("client_id", clientId)
    .order("position");

  const rows = items ?? [];
  if (rows.length === 0) return [];

  const { data: contents } = await supabase
    .from("contents")
    .select("id, title, type")
    .in(
      "id",
      rows.map((row) => row.content_id),
    );

  const byId = new Map((contents ?? []).map((content) => [content.id, content]));
  const previews = await loadContentPreviews(
    supabase,
    rows.map((row) => row.content_id),
  );

  return rows.flatMap((row) => {
    const content = byId.get(row.content_id);
    if (!content) return [];
    return [
      {
        feedItemId: row.id,
        contentId: row.content_id,
        title: content.title,
        type: content.type,
        previewUrl: previews.get(row.content_id) ?? null,
        position: row.position,
      },
    ];
  });
}

/** Mural: posts publicados, com contagem e o voto de quem pediu. */
export async function loadBulletinFeed(supabase: Client): Promise<BulletinFeedRow[]> {
  const { data } = await supabase.rpc("bulletin_feed");
  return data ?? [];
}

/**
 * Mural para o admin gerenciar: junta rascunho + publicado (so admin le
 * rascunho, via RLS) com a contagem que ja existir em `bulletin_feed` — post
 * ainda rascunho nunca tem voto, entao 0/0/null e sempre correto para ele.
 */
export async function loadBulletinAdminList(
  supabase: Client,
): Promise<(BulletinFeedRow & { published: boolean })[]> {
  const [{ data: posts }, feed] = await Promise.all([
    supabase.from("bulletin_posts").select("*").order("created_at", { ascending: false }),
    loadBulletinFeed(supabase),
  ]);

  const feedById = new Map(feed.map((row) => [row.id, row]));

  return (posts ?? []).map((post) => {
    const counted = feedById.get(post.id);
    return {
      id: post.id,
      title: post.title,
      body: post.body,
      scheduled_date: post.scheduled_date,
      created_at: post.created_at,
      likes: counted?.likes ?? 0,
      dislikes: counted?.dislikes ?? 0,
      my_vote: counted?.my_vote ?? null,
      published: post.published,
    };
  });
}

/** Relatorio de votos do mural — so admin. */
export async function loadBulletinAdminReport(
  supabase: Client,
): Promise<BulletinAdminReportRow[]> {
  const { data } = await supabase.rpc("bulletin_admin_report");
  return data ?? [];
}

/** Calendario de publicacoes: proximos conteudos com data agendada, mais cedo primeiro. */
export async function loadUpcomingContents(
  supabase: Client,
  limit = 3,
): Promise<ContentRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("contents")
    .select("*")
    .gte("scheduled_date", today)
    .not("scheduled_date", "is", null)
    .order("scheduled_date", { ascending: true })
    .limit(limit);
  return data ?? [];
}

/**
 * Projetos ativos: escopo combinado com o cliente, na ordem cadastrada.
 * `clientId` e opcional na area do cliente (a RLS ja so devolve o proprio),
 * mas obrigatorio na pratica quando chamado da tela da equipe — sem ele, um
 * profissional com varios clientes veria o escopo de todos misturado.
 */
export async function loadClientServices(
  supabase: Client,
  clientId?: string,
): Promise<ClientServiceRow[]> {
  let query = supabase.from("client_services").select("*").order("position", { ascending: true });
  if (clientId) query = query.eq("client_id", clientId);
  const { data } = await query;
  return data ?? [];
}

/** Atividades recentes do cliente, mais nova primeiro. Mesma ressalva do `clientId` acima. */
export async function loadClientActivities(
  supabase: Client,
  limit = 8,
  clientId?: string,
): Promise<ClientActivityRow[]> {
  let query = supabase
    .from("client_activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (clientId) query = query.eq("client_id", clientId);
  const { data } = await query;
  return data ?? [];
}
