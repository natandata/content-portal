import { FileVideo } from "lucide-react";

import { ReferenceTranscriptionForm } from "@/components/reference-transcriptions/reference-transcription-form";
import { ReferenceTranscriptionList } from "@/components/reference-transcriptions/reference-transcription-list";
import { EmptyState } from "@/components/ui/feedback";
import { loadClientReferenceTranscriptions } from "@/server/actions/reference-transcriptions";
import type { ClientReferenceRow } from "@/types/database";

/**
 * Aba "Ideias de Conteudo (IA)": escolhe links do Banco de Referencias,
 * baixa+transcreve+reescreve via worker do Railway (sem polling -- so
 * dispara quando a equipe clica), e mostra o historico com o texto pronto
 * pra copiar. Nao cria rascunho em Conteudos -- e so leitura/copia.
 */
export async function ReferenceTranscriptionHub({
  clientId,
  references,
}: {
  clientId: string;
  references: ClientReferenceRow[];
}) {
  const transcriptions = await loadClientReferenceTranscriptions(clientId);
  const referenceTitles = new Map(references.map((reference) => [reference.id, reference.title]));

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500">
        Escolha links do Banco de Referências para transcrever e reescrever com outras palavras (evita
        cópia literal) — o texto fica pronto para copiar e adaptar na hora de criar o conteúdo.
      </p>

      {references.length === 0 ? (
        <EmptyState
          icon={<FileVideo className="size-5" />}
          title="Nenhum link no Banco de Referências"
          description="Cadastre links na aba 'Banco de Referências' antes de transcrever."
        />
      ) : (
        <ReferenceTranscriptionForm clientId={clientId} references={references} />
      )}

      <ReferenceTranscriptionList transcriptions={transcriptions} referenceTitles={referenceTitles} />
    </div>
  );
}
