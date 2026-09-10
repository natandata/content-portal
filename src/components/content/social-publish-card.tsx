"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publishContentToSocialAction } from "@/server/actions/social-publish";
import type { SocialConnectionStatus } from "@/server/actions/social-connect";
import type { PublishTargetStatus } from "@/server/actions/social-publish";
import type { SocialPlatform } from "@/types/database";

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  idle: { label: "Nao publicado", tone: "neutral" },
  publishing: { label: "Publicando...", tone: "info" },
  published: { label: "Publicado", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
};

/**
 * Publicar agora numa rede alem do Instagram (que tem seu proprio card).
 * So mostra conexoes prontas -- Facebook/Pinterest precisam de Page/board
 * escolhido antes, LinkedIn precisa do autor resolvido; sem isso a conexao
 * nem aparece aqui (staff resolve na aba do cliente).
 */
export function SocialPublishCard({
  contentId,
  connections,
  targets,
  canPublish,
}: {
  contentId: string;
  connections: SocialConnectionStatus[];
  targets: PublishTargetStatus[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const ready = connections.filter((connection) => {
    if (connection.needsTargetSelection) return false;
    if (connection.platform === "linkedin" && !connection.platformData.authorUrn) return false;
    return true;
  });

  if (ready.length === 0) return null;

  const targetByPlatform = new Map(targets.map((target) => [target.platform, target]));

  return (
    <ul className="space-y-2">
      {ready.map((connection) => {
        const target = targetByPlatform.get(connection.platform);
        const statusInfo = target ? STATUS_LABEL[target.status] : null;

        return (
          <li key={connection.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink-800">
              <span className="font-medium">{PLATFORM_LABEL[connection.platform]}</span>
              {connection.label ? <span className="truncate text-ink-500">· {connection.label}</span> : null}
              {statusInfo ? <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge> : null}
            </span>
            <Button
              size="sm"
              disabled={!canPublish || target?.status === "published" || target?.status === "publishing"}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await publishContentToSocialAction(contentId, connection.platform, connection.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`Publicado no ${PLATFORM_LABEL[connection.platform]}.`);
                  router.refresh();
                })
              }
            >
              <Send className="size-3.5" aria-hidden />
              Publicar
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
