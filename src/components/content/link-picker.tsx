"use client";

import { ExternalLink, Link2 } from "lucide-react";

import { Field, Input } from "@/components/ui/form";
import { linkProviderLabel, normalizeExternalUrl } from "@/lib/domain";

/**
 * Alternativa ao upload: o arquivo fica no Drive/WeTransfer/OneDrive e o portal
 * guarda so o endereco. Serve principalmente para video, que e pesado demais
 * para subir a cada revisao.
 */
export function LinkPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const normalized = normalizeExternalUrl(value);
  const touched = value.trim().length > 0;

  return (
    <div>
      <Field
        label="Link do arquivo"
        htmlFor="externalUrl"
        hint="Cole o link de compartilhamento. Confira se ele esta liberado para quem tem o endereco."
      >
        <Input
          id="externalUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://drive.google.com/..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </Field>

      {touched && !normalized ? (
        <p className="mt-2 text-xs font-medium text-red-600">
          Link invalido. Use um endereco comecando com https://
        </p>
      ) : null}

      {normalized ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-50/60 px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-500">
            <Link2 className="size-4" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-900">{linkProviderLabel(normalized)}</p>
            <p className="truncate text-xs text-ink-500">{normalized}</p>
          </div>

          <a
            href={normalized}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-700 transition hover:text-ink-900"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Testar
          </a>
        </div>
      ) : null}
    </div>
  );
}
