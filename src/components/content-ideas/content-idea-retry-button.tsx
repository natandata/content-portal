"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { retryContentIdeaGenerationAction } from "@/server/actions/content-ideas";

export function ContentIdeaRetryButton({ generationId }: { generationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await retryContentIdeaGenerationAction(generationId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Geracao reiniciada.");
          router.refresh();
        })
      }
    >
      <RotateCw className="size-4" aria-hidden />
      Tentar de novo
    </Button>
  );
}
