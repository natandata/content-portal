"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { retryReferenceTranscriptionsAction } from "@/server/actions/reference-transcriptions";

export function ReferenceTranscriptionRetryButton({ transcriptionId }: { transcriptionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await retryReferenceTranscriptionsAction([transcriptionId]);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Transcricao reiniciada.");
          router.refresh();
        })
      }
    >
      <RotateCw className="size-4" aria-hidden />
      Tentar de novo
    </Button>
  );
}
