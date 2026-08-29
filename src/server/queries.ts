import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileView } from "@/components/feed/instagram-profile";
import { BUCKETS } from "@/lib/paths";
import { signedUrl, signedUrlMap } from "@/lib/storage";
import type {
  ContentFileRow,
  ContentRow,
  ContentStatus,
  Database,
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
