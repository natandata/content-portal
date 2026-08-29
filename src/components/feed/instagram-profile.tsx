import { ChevronDown, Lock, Plus, User } from "lucide-react";

import { formatCount } from "@/lib/domain";

export interface ProfileHighlightView {
  id: string;
  title: string;
  coverUrl: string | null;
}

export interface ProfileView {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  postsCount: number;
  /** True quando o numero espelha o feed real em vez de um valor digitado. */
  postsCountIsAuto: boolean;
  followersCount: number;
  followingCount: number;
  showReelsTab: boolean;
  highlights: ProfileHighlightView[];
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-sm font-semibold text-ink-900 tabular-nums">
        {formatCount(value)}
      </span>
      <span className="text-xs text-ink-500">{label}</span>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="size-[72px] shrink-0 overflow-hidden rounded-full bg-ink-100 ring-1 ring-line">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Foto de perfil de ${name}`} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-ink-300">
          <User className="size-7" aria-hidden />
        </div>
      )}
    </div>
  );
}

/**
 * Cabecalho do perfil: e o que faz a simulacao parecer o Instagram de verdade.
 * Somente leitura — a edicao vive no `ProfileEditor` da area da equipe.
 */
export function InstagramHeader({
  profile,
  fallbackName,
}: {
  profile: ProfileView;
  fallbackName: string;
}) {
  const name = profile.displayName || fallbackName;
  const handle = profile.username || "usuario";

  return (
    <header>
      {/* Barra superior do app */}
      <div className="flex items-center gap-1.5 px-4 py-3">
        <Lock className="size-3.5 text-ink-500" aria-hidden />
        <span className="truncate text-sm font-semibold text-ink-900">{handle}</span>
        <ChevronDown className="size-4 text-ink-500" aria-hidden />
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-6">
          <Avatar url={profile.avatarUrl} name={name} />

          <div className="grid flex-1 grid-cols-3 gap-1">
            <Stat value={profile.postsCount} label="publicacoes" />
            <Stat value={profile.followersCount} label="seguidores" />
            <Stat value={profile.followingCount} label="seguindo" />
          </div>
        </div>

        <div className="mt-3">
          <p className="text-sm font-semibold text-ink-900">{name}</p>
          {profile.bio ? (
            <p className="mt-0.5 text-sm whitespace-pre-wrap text-ink-700">{profile.bio}</p>
          ) : null}
        </div>

        {/* Botoes do perfil — decorativos, so para completar a moldura. */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="rounded-lg bg-ink-100 py-1.5 text-center text-xs font-semibold text-ink-800">
            Seguir
          </span>
          <span className="rounded-lg bg-ink-100 py-1.5 text-center text-xs font-semibold text-ink-800">
            Mensagem
          </span>
        </div>
      </div>

      {profile.highlights.length > 0 ? (
        <div className="scroll-slim flex gap-4 overflow-x-auto px-4 pb-4">
          {profile.highlights.map((highlight) => (
            <div key={highlight.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <div className="size-14 overflow-hidden rounded-full bg-ink-100 p-0.5 ring-1 ring-line">
                {highlight.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={highlight.coverUrl}
                    alt={highlight.title}
                    className="size-full rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center rounded-full text-ink-300">
                    <Plus className="size-5" aria-hidden />
                  </div>
                )}
              </div>
              <span className="w-full truncate text-center text-[11px] text-ink-600">
                {highlight.title}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
