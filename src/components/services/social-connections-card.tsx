"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, CardHeader } from "@/components/ui/layout";
import {
  disconnectSocialAction,
  loadSocialTargetOptionsAction,
  setSocialTargetAction,
  startSocialConnectAction,
  type SocialConnectionStatus,
  type SocialTargetOption,
} from "@/server/actions/social-connect";
import type { SocialPlatform } from "@/types/database";

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

/**
 * Conexoes com redes sociais alem do Instagram (que tem sua propria tela em
 * Relatorios). TikTok/YouTube nao precisam de nenhuma escolha extra depois
 * do OAuth; Facebook/Pinterest exigem escolher a Page/board antes de poder
 * publicar (`needsTargetSelection`).
 */
export function SocialConnectionsCard({
  clientId,
  connections,
}: {
  clientId: string;
  connections: SocialConnectionStatus[];
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<SocialPlatform>("tiktok");
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader title="Redes sociais" />

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <Field label="Rede" htmlFor="social-platform">
          <Select
            id="social-platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value as SocialPlatform)}
            disabled={pending}
          >
            {(Object.keys(PLATFORM_LABEL) as SocialPlatform[]).map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Apelido (opcional)" htmlFor="social-label">
          <Input
            id="social-label"
            placeholder="Ex.: Pagina principal"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={pending}
            className="max-w-[200px]"
          />
        </Field>
        <Button
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await startSocialConnectAction(clientId, platform, label);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              window.location.assign(result.data.url);
            })
          }
        >
          <ExternalLink className="size-4" aria-hidden />
          Conectar
        </Button>
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-ink-500">Nenhuma rede conectada ainda.</p>
      ) : (
        <ul className="space-y-2.5">
          {connections.map((connection) => (
            <ConnectionRow key={connection.id} connection={connection} onChanged={() => router.refresh()} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ConnectionRow({
  connection,
  onChanged,
}: {
  connection: SocialConnectionStatus;
  onChanged: () => void;
}) {
  const [options, setOptions] = useState<SocialTargetOption[] | null>(null);
  const [pending, startTransition] = useTransition();

  const targetName =
    connection.platform === "facebook"
      ? (connection.platformData.pageName as string | undefined)
      : connection.platform === "pinterest"
        ? (connection.platformData.boardName as string | undefined)
        : null;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm text-ink-800">
          <span className="font-medium">{PLATFORM_LABEL[connection.platform]}</span>
          {connection.label ? <span className="truncate text-ink-500">· {connection.label}</span> : null}
          {targetName ? <Badge tone="info">{targetName}</Badge> : null}
          {connection.needsTargetSelection ? <Badge tone="warning">Falta escolher destino</Badge> : null}
        </span>
        <IconButton
          label="Desconectar"
          className="size-7 text-ink-400 hover:text-red-600"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await disconnectSocialAction(connection.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              onChanged();
            })
          }
        >
          <Unlink className="size-3.5" />
        </IconButton>
      </div>

      {connection.needsTargetSelection ? (
        <div className="flex items-center gap-2">
          {options === null ? (
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await loadSocialTargetOptionsAction(connection.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setOptions(result.data);
                })
              }
            >
              {connection.platform === "facebook" ? "Escolher Page" : "Escolher board"}
            </Button>
          ) : options.length === 0 ? (
            <p className="text-xs text-ink-500">Nenhuma opcao encontrada nesta conta.</p>
          ) : (
            <Select
              defaultValue=""
              disabled={pending}
              onChange={(event) => {
                const chosen = options.find((option) => option.id === event.target.value);
                if (!chosen) return;
                startTransition(async () => {
                  const result = await setSocialTargetAction(connection.id, chosen.id, chosen.name);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Destino salvo.");
                  onChanged();
                });
              }}
            >
              <option value="" disabled>
                Selecione...
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      ) : null}
    </li>
  );
}
