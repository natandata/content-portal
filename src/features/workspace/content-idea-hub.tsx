import Link from "next/link";
import { Sparkles } from "lucide-react";

import { ContentIdeaGenerateModal } from "@/components/content-ideas/content-idea-generate-modal";
import { ContentIdeaRetryButton } from "@/components/content-ideas/content-idea-retry-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Card } from "@/components/ui/layout";
import type { BadgeTone } from "@/lib/domain";
import { formatDateTime } from "@/lib/utils";
import { loadContentIdeaGenerations } from "@/server/actions/content-ideas";
import type { ContentIdeaGenerationRow, ContentIdeaGenerationStatus } from "@/types/database";

const STATUS_LABEL: Record<ContentIdeaGenerationStatus, string> = {
  pending: "Na fila",
  scraping: "Lendo os perfis...",
  analyzing: "Gerando as ideias...",
  done: "Concluida",
  failed: "Falhou",
};

const STATUS_TONE: Record<ContentIdeaGenerationStatus, BadgeTone> = {
  pending: "neutral",
  scraping: "info",
  analyzing: "info",
  done: "success",
  failed: "danger",
};

/**
 * Aba "Ideias de Conteudo (IA)" na pagina do cliente: histórico de gerações
 * + botão pra iniciar uma nova. Cada geração roda em segundo plano (webhook
 * do Apify + IA) -- esta tela só lê o estado atual, sem polling: reabrir a
 * página ou dar refresh mostra o progresso mais recente.
 */
export async function ContentIdeaHub({
  clientId,
  basePath,
  defaultClientUsername,
}: {
  clientId: string;
  basePath: string;
  defaultClientUsername?: string;
}) {
  const generations = await loadContentIdeaGenerations(clientId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          Analisa perfis de referência, o relatório de métricas e o Banco de Referências pra sugerir 20
          posts adaptados ao cliente.
        </p>
        <ContentIdeaGenerateModal clientId={clientId} defaultClientUsername={defaultClientUsername} />
      </div>

      {generations.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title="Nenhuma geração ainda"
          description="Clique em 'Nova geração' pra criar as primeiras 20 ideias de conteúdo."
        />
      ) : (
        <div className="space-y-3">
          {generations.map((generation) => (
            <GenerationCard key={generation.id} generation={generation} basePath={basePath} />
          ))}
        </div>
      )}
    </div>
  );
}

function GenerationCard({
  generation,
  basePath,
}: {
  generation: ContentIdeaGenerationRow;
  basePath: string;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">
            Referências: {generation.reference_usernames.map((u) => `@${u}`).join(", ")}
          </p>
          <p className="text-xs text-ink-500">
            Perfil analisado: @{generation.client_username} · {formatDateTime(generation.created_at)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[generation.status]}>{STATUS_LABEL[generation.status]}</Badge>
      </div>

      {generation.status === "failed" && generation.error ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{generation.error}</p>
          <ContentIdeaRetryButton generationId={generation.id} />
        </div>
      ) : null}

      {generation.status === "done" && generation.created_content_ids?.length ? (
        <p className="mt-3 text-sm text-ink-600">
          <strong className="text-ink-900 tabular-nums">{generation.created_content_ids.length}</strong>{" "}
          rascunhos criados —{" "}
          <Link
            href={`${basePath}/content?client=${generation.client_id}&status=draft`}
            className="focus-ring font-medium text-accent"
          >
            abrir Conteúdos
          </Link>
        </p>
      ) : null}
    </Card>
  );
}
