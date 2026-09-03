"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { MAX_PLATFORM_FEE_PERCENT } from "@/lib/money";
import { setPlatformFeeAction } from "@/server/actions/stripe-connect";

/** Um campo so — inline, sem modal. */
export function PlatformFeeForm({
  userId,
  current,
}: {
  userId: string;
  current: number;
}) {
  const router = useRouter();
  const [percent, setPercent] = useState(String(current));
  const [pending, start] = useTransition();

  const dirty = percent !== String(current);

  return (
    <div className="flex items-end gap-2">
      <label className="flex-1">
        <span className="field-label">Comissao da plataforma</span>
        <div className="relative">
          <Input
            type="number"
            min="0"
            max={MAX_PLATFORM_FEE_PERCENT}
            step="0.1"
            inputMode="decimal"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            disabled={pending}
            className="pr-8"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-400">
            %
          </span>
        </div>
      </label>

      <Button
        loading={pending}
        disabled={!dirty}
        onClick={() =>
          start(async () => {
            const result = await setPlatformFeeAction({ userId, percent });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Comissao atualizada.");
            router.refresh();
          })
        }
      >
        Salvar
      </Button>
    </div>
  );
}
