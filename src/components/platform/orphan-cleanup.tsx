"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BrushCleaning } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatBytes } from "@/lib/utils";
import {
  countOrphanFilesAction,
  deleteOrphanFilesAction,
  type OrphanSummary,
} from "@/server/actions/platform";

/**
 * Arquivo orfao e o que ficou no Storage sem linha correspondente no banco —
 * sobra de upload que concluiu e nao chegou a ser gravado. Conferir primeiro,
 * apagar depois: o passo de conferencia existe justamente porque apagar aqui
 * nao tem volta.
 */
export function OrphanCleanup() {
  const router = useRouter();
  const [summary, setSummary] = useState<OrphanSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function check() {
    startTransition(async () => {
      const result = await countOrphanFilesAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.data);
      if (result.data.files === 0) toast.success("Nenhum arquivo orfao.");
    });
  }

  function clean() {
    startTransition(async () => {
      const result = await deleteOrphanFilesAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.files === 0
          ? "Nada a limpar."
          : `${result.data.files} arquivo(s) removido(s) — ${formatBytes(result.data.bytes)} liberados.`,
      );
      setSummary({ files: 0, bytes: 0, byBucket: [] });
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink-900">Limpar arquivos orfaos</h3>
      <p className="mt-1 text-sm text-ink-500">
        Remove arquivos que ficaram no Storage sem registro correspondente — sobra de envio
        interrompido.
      </p>

      {summary ? (
        <div className="mt-3 rounded-lg border border-line bg-ink-50 px-3 py-2.5">
          {summary.files === 0 ? (
            <p className="text-sm text-ink-700">Nada sobrando: o Storage esta limpo.</p>
          ) : (
            <>
              <p className="text-sm text-ink-900">
                {summary.files} arquivo(s) · {formatBytes(summary.bytes)}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {summary.byBucket.map((entry) => (
                  <li key={entry.bucket} className="text-xs text-ink-500">
                    {entry.bucket}: {entry.files} · {formatBytes(entry.bytes)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" loading={pending} onClick={check}>
          Conferir
        </Button>

        {summary && summary.files > 0 ? (
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmOpen(true)}
          >
            <BrushCleaning className="size-4" aria-hidden />
            Limpar agora
          </Button>
        ) : null}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !pending && setConfirmOpen(false)}
        title="Limpar arquivos orfaos"
        description="A remocao e definitiva."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" loading={pending} onClick={clean}>
              Limpar
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          {summary?.files ?? 0} arquivo(s) sem registro no banco serao apagados do Storage,
          liberando {formatBytes(summary?.bytes ?? 0)}. Nenhum conteudo, documento ou foto em uso
          e afetado.
        </p>
      </Modal>
    </div>
  );
}
