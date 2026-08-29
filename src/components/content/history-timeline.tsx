import { History } from "lucide-react";

import { formatDateTime } from "@/lib/utils";
import type { ApprovalHistoryRow } from "@/types/database";

export function HistoryTimeline({ entries }: { entries: ApprovalHistoryRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <History className="size-4" aria-hidden />
        Nenhum movimento registrado ate agora.
      </p>
    );
  }

  return (
    <ol className="relative space-y-5 border-l border-line pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute top-1.5 -left-[23px] size-2 rounded-full bg-ink-300 ring-4 ring-surface" />
          <p className="text-xs text-ink-400">{formatDateTime(entry.created_at)}</p>
          <p className="mt-0.5 text-sm font-medium text-ink-900">{entry.action}</p>
          {entry.actor_name ? (
            <p className="text-xs text-ink-500">{entry.actor_name}</p>
          ) : null}
          {entry.comment ? (
            <p className="mt-2 rounded-lg border border-line bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {entry.comment}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
