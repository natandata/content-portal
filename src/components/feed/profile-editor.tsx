"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Image as ImageIcon, Plus, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { MAX_HIGHLIGHTS } from "@/lib/domain";
import { BUCKETS, avatarPath, highlightCoverPath } from "@/lib/paths";
import { createImageThumbnail, uploadToBucket, validateFile } from "@/lib/upload";
import { saveClientProfileAction, saveHighlightsAction } from "@/server/actions/profile";
import type { ClientProfileRow } from "@/types/database";

export interface HighlightDraft {
  id: string;
  title: string;
  coverPath: string | null;
  coverUrl: string | null;
  file?: File;
}

interface Props {
  clientId: string;
  fallbackName: string;
  profile: ClientProfileRow | null;
  avatarUrl: string | null;
  highlights: HighlightDraft[];
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Numero digitado pelo usuario; vazio vira 0. */
function toCount(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

/**
 * So digitos, sem zero a esquerda — sem isso, digitar em um campo que mostra
 * "0" produz "012400".
 */
function digitsOnly(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits;
}

export function ProfileEditor({
  clientId,
  fallbackName,
  profile,
  avatarUrl,
  highlights,
}: Props) {
  const router = useRouter();
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const coverTarget = useRef<string | null>(null);

  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [followers, setFollowers] = useState(String(profile?.followers_count ?? 0));
  const [following, setFollowing] = useState(String(profile?.following_count ?? 0));
  const [postsCount, setPostsCount] = useState(
    profile?.posts_count === null || profile?.posts_count === undefined
      ? ""
      : String(profile.posts_count),
  );
  const [showReels, setShowReels] = useState(profile?.show_reels_tab ?? true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [items, setItems] = useState<HighlightDraft[]>(highlights);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickAvatar(file: File) {
    const message = validateFile(file, "image");
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function pickCover(id: string, file: File) {
    const message = validateFile(file, "image");
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, file, coverUrl: url } : item)),
    );
  }

  async function submit() {
    setError(null);
    setBusy(true);

    try {
      // A foto de perfil e exibida pequena: reduz antes de subir.
      let nextAvatarPath = profile?.avatar_path ?? null;
      if (avatarFile) {
        const resized = (await createImageThumbnail(avatarFile, 600)) ?? avatarFile;
        const path = avatarPath(clientId, avatarFile.name);
        const result = await uploadToBucket(BUCKETS.profiles, path, resized, "image/jpeg");
        if (result.error) {
          setError(`Falha ao enviar a foto de perfil: ${result.error}`);
          return;
        }
        nextAvatarPath = path;
      }

      const payload: HighlightDraft[] = [];
      for (const [index, item] of items.entries()) {
        if (!item.title.trim()) {
          setError("Todo destaque precisa de um nome.");
          return;
        }

        let coverPath = item.coverPath;
        if (item.file) {
          const resized = (await createImageThumbnail(item.file, 400)) ?? item.file;
          const path = highlightCoverPath(clientId, index + 1, item.file.name);
          const result = await uploadToBucket(BUCKETS.profiles, path, resized, "image/jpeg");
          if (result.error) {
            setError(`Falha ao enviar a capa de "${item.title}": ${result.error}`);
            return;
          }
          coverPath = path;
        }

        payload.push({ ...item, coverPath });
      }

      const saved = await saveClientProfileAction({
        clientId,
        displayName,
        username,
        bio,
        avatarPath: nextAvatarPath,
        postsCount: postsCount.trim() === "" ? null : toCount(postsCount),
        followersCount: toCount(followers),
        followingCount: toCount(following),
        showReelsTab: showReels,
      });

      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      const savedHighlights = await saveHighlightsAction(
        clientId,
        payload.map((item) => ({ title: item.title.trim(), coverPath: item.coverPath })),
      );

      if (!savedHighlights.ok) {
        setError(savedHighlights.error);
        return;
      }

      toast.success("Perfil atualizado.");
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha inesperada ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Editar perfil
      </Button>

      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) pickAvatar(file);
        }}
      />

      <input
        ref={coverInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const id = coverTarget.current;
          event.target.value = "";
          if (file && id) pickCover(id, file);
        }}
      />

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Perfil do Instagram"
        description="O cliente ve exatamente estes dados na simulacao do feed."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="size-16 shrink-0 overflow-hidden rounded-full bg-ink-100 ring-1 ring-line">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-ink-300">
                  <User className="size-6" aria-hidden />
                </div>
              )}
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => avatarInput.current?.click()}
              >
                {avatarPreview ? "Trocar foto" : "Adicionar foto"}
              </Button>
              <p className="mt-1.5 text-xs text-ink-500">JPG, PNG ou WEBP.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="profile-name" hint={`Padrao: ${fallbackName}`}>
              <Input
                id="profile-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={fallbackName}
                maxLength={60}
                disabled={busy}
              />
            </Field>

            <Field label="@" htmlFor="profile-username">
              <Input
                id="profile-username"
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))}
                placeholder="minhamarca"
                maxLength={30}
                disabled={busy}
              />
            </Field>

            <Field label="Bio" htmlFor="profile-bio" className="sm:col-span-2">
              <Textarea
                id="profile-bio"
                rows={3}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={300}
                placeholder={"O que a marca faz\nLink na bio"}
                disabled={busy}
              />
            </Field>

            <Field
              label="Publicacoes"
              htmlFor="profile-posts"
              hint="Vazio usa a contagem real do feed."
            >
              <Input
                id="profile-posts"
                inputMode="numeric"
                value={postsCount}
                onChange={(event) => setPostsCount(digitsOnly(event.target.value))}
                onFocus={(event) => event.target.select()}
                placeholder="automatico"
                disabled={busy}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Seguidores" htmlFor="profile-followers">
                <Input
                  id="profile-followers"
                  inputMode="numeric"
                  value={followers}
                  onChange={(event) => setFollowers(digitsOnly(event.target.value))}
                  onFocus={(event) => event.target.select()}
                  disabled={busy}
                />
              </Field>

              <Field label="Seguindo" htmlFor="profile-following">
                <Input
                  id="profile-following"
                  inputMode="numeric"
                  value={following}
                  onChange={(event) => setFollowing(digitsOnly(event.target.value))}
                  onFocus={(event) => event.target.select()}
                  disabled={busy}
                />
              </Field>
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-line bg-ink-50/60 px-3 py-2.5">
            <input
              type="checkbox"
              checked={showReels}
              onChange={(event) => setShowReels(event.target.checked)}
              disabled={busy}
              className="mt-0.5 size-4 accent-ink-900"
            />
            <span>
              <span className="block text-sm font-medium text-ink-900">Mostrar aba de reels</span>
              <span className="block text-xs text-ink-500">
                A aba lista os conteudos de video que estao no feed.
              </span>
            </span>
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Destaques</h3>
              <span className="text-xs text-ink-500 tabular-nums">
                {items.length}/{MAX_HIGHLIGHTS}
              </span>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      coverTarget.current = item.id;
                      coverInput.current?.click();
                    }}
                    className="focus-ring size-11 shrink-0 overflow-hidden rounded-full bg-ink-100 ring-1 ring-line"
                    aria-label={`Capa do destaque ${item.title || "sem nome"}`}
                  >
                    {item.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.coverUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-ink-400">
                        <ImageIcon className="size-4" aria-hidden />
                      </span>
                    )}
                  </button>

                  <Input
                    value={item.title}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id ? { ...entry, title: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder="Nome do destaque"
                    maxLength={20}
                    disabled={busy}
                  />

                  <IconButton
                    label="Remover destaque"
                    className="shrink-0 hover:text-red-600"
                    onClick={() =>
                      setItems((current) => current.filter((entry) => entry.id !== item.id))
                    }
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              ))}
            </div>

            {items.length < MAX_HIGHLIGHTS ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5"
                disabled={busy}
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    { id: newId(), title: "", coverPath: null, coverUrl: null },
                  ])
                }
              >
                <Plus className="size-4" aria-hidden />
                Adicionar destaque
              </Button>
            ) : null}
          </div>

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
