import { ThumbsDown, ThumbsUp } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/layout";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import type { BulletinAdminReportRow } from "@/types/database";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  professional: "Profissional",
  client: "Cliente",
};

/** So o admin ve: quem votou o que, em cada novidade — inclusive rascunho. */
export function VotesReport({
  report,
  locale,
}: {
  report: BulletinAdminReportRow[];
  locale: Locale;
}) {
  const dict = getDictionary(locale).bulletin;

  return (
    <Card className="mt-6">
      <CardHeader title={dict.reportTitle} />

      {report.length === 0 ? (
        <p className="text-sm text-ink-500">{dict.reportEmpty}</p>
      ) : (
        <div className="space-y-5">
          {report.map((entry) => (
            <div key={entry.post_id} className="border-t border-line pt-4 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-900">
                  {entry.title}
                  {!entry.published ? (
                    <span className="ml-2 text-xs font-normal text-ink-400">({dict.draft})</span>
                  ) : null}
                </p>
                <div className="flex items-center gap-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <ThumbsUp className="size-3.5" aria-hidden />
                    {entry.likes}
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <ThumbsDown className="size-3.5" aria-hidden />
                    {entry.dislikes}
                  </span>
                </div>
              </div>

              {entry.voters.length === 0 ? (
                <p className="mt-1.5 text-xs text-ink-400">{dict.votersEmpty}</p>
              ) : (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {entry.voters.map((voter, index) => (
                    <li
                      key={`${entry.post_id}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700"
                    >
                      {voter.vote === 1 ? (
                        <ThumbsUp className="size-3 text-emerald-600" aria-hidden />
                      ) : (
                        <ThumbsDown className="size-3 text-red-600" aria-hidden />
                      )}
                      {voter.name}
                      <span className="text-ink-400">· {ROLE_LABEL[voter.role] ?? voter.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
