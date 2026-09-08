import { AlertTriangle, BadgeCheck, ExternalLink, Loader2, MessageCircle, ThumbsUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/layout";
import { formatDateTime } from "@/lib/utils";
import { InstagramPublicReportDeleteButton } from "@/components/reports/instagram-public-report-delete-button";
import type { InstagramPublicReportRow } from "@/types/database";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function bool(value: unknown): boolean {
  return value === true;
}

/**
 * Um relatorio de perfil publico (relatorio 1). Os campos de `summary`/`posts`
 * vem crus do ator `apify/instagram-profile-scraper` (jsonb, sem schema fixo
 * no banco) -- por isso toda leitura aqui e defensiva: um campo ausente so
 * some da tela, nunca quebra a renderizacao.
 */
export function InstagramPublicReportCard({
  report,
  clientId,
}: {
  report: InstagramPublicReportRow;
  clientId: string;
}) {
  if (report.status === "pending" || report.status === "running") {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-ink-600">
            <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
            Coletando dados de <strong className="text-ink-900">@{report.username}</strong>... isso pode levar
            alguns minutos.
          </div>
          <InstagramPublicReportDeleteButton reportId={report.id} clientId={clientId} />
        </div>
      </Card>
    );
  }

  if (report.status === "failed") {
    return (
      <Card className="border-red-200 bg-red-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p>Falha ao gerar o relatorio de @{report.username}.</p>
              {report.error ? <p className="mt-1 text-xs text-red-600">{report.error}</p> : null}
            </div>
          </div>
          <InstagramPublicReportDeleteButton reportId={report.id} clientId={clientId} />
        </div>
      </Card>
    );
  }

  const summary = report.summary ?? {};
  const followers = num(summary.followersCount);
  const following = num(summary.followsCount);
  const postsCount = num(summary.postsCount);
  const biography = str(summary.biography);
  const fullName = str(summary.fullName);
  const profilePicUrl = str(summary.profilePicUrl);
  const verified = bool(summary.verified);
  const isBusiness = bool(summary.isBusinessAccount);
  const isPrivate = bool(summary.private);
  const externalUrl = str(summary.externalUrl);
  const posts = Array.isArray(report.posts) ? report.posts : [];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {profilePicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profilePicUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
          ) : null}
          <div>
            <div className="flex items-center gap-1.5">
              <a
                href={`https://instagram.com/${report.username}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-ink-900 hover:underline"
              >
                @{report.username}
              </a>
              {verified ? <BadgeCheck className="size-4 text-accent" aria-hidden /> : null}
            </div>
            {fullName ? <p className="text-sm text-ink-500">{fullName}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {isBusiness ? <Badge tone="info">Business/Creator</Badge> : null}
          {isPrivate ? <Badge tone="neutral">Privado</Badge> : null}
          <InstagramPublicReportDeleteButton reportId={report.id} clientId={clientId} />
        </div>
      </div>

      {biography ? <p className="mt-3 whitespace-pre-line text-sm text-ink-600">{biography}</p> : null}
      {externalUrl ? (
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          {externalUrl}
        </a>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-3 border-y border-line py-3 text-center">
        <Stat label="Seguidores" value={followers} />
        <Stat label="Seguindo" value={following} />
        <Stat label="Posts" value={postsCount} />
      </div>

      {posts.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.slice(0, 12).map((post, index) => (
            <PostCard key={index} post={post as Record<string, unknown>} />
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-ink-400">
        Gerado em {formatDateTime(report.completed_at ?? report.created_at)}
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums text-ink-900">
        {value != null ? value.toLocaleString("pt-BR") : "—"}
      </p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}

function PostCard({ post }: { post: Record<string, unknown> }) {
  const caption = str(post.caption);
  const likes = num(post.likesCount);
  const comments = num(post.commentsCount);
  const displayUrl = str(post.displayUrl);
  const postUrl = str(post.url);

  return (
    <a
      href={postUrl ?? undefined}
      target={postUrl ? "_blank" : undefined}
      rel="noreferrer"
      className="block overflow-hidden rounded-lg border border-line"
    >
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />
      ) : (
        <div className="aspect-square w-full bg-ink-100" />
      )}
      <div className="space-y-1 p-2.5">
        {caption ? <p className="line-clamp-2 text-xs text-ink-600">{caption}</p> : null}
        <div className="flex items-center gap-3 text-xs text-ink-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="size-3" aria-hidden />
            {likes != null ? likes.toLocaleString("pt-BR") : "—"}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3" aria-hidden />
            {comments != null ? comments.toLocaleString("pt-BR") : "—"}
          </span>
        </div>
      </div>
    </a>
  );
}
