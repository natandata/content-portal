import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Layers } from "lucide-react";

import { ContentThumb } from "@/components/content/content-thumb";
import { ContentStatusBadge } from "@/components/ui/badge";
import { CONTENT_TYPE_LABEL } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/utils";
import type { ContentRow } from "@/types/database";

/**
 * Linha da "tabela visual" de conteudos: capa grande, dados essenciais e as
 * acoes sempre visiveis na base do card. `locale` e opcional (default pt-BR) —
 * so a area do cliente passa "en".
 */
export function ContentCard({
  content,
  previewUrl,
  fileCount,
  clientName,
  href,
  locale = DEFAULT_LOCALE,
  actions,
}: {
  content: ContentRow;
  previewUrl: string | null;
  fileCount: number;
  clientName?: string;
  href: string;
  locale?: Locale;
  actions?: ReactNode;
}) {
  const dict = getDictionary(locale);
  const typeLabel = locale === DEFAULT_LOCALE ? CONTENT_TYPE_LABEL[content.type] : dict.contentType[content.type];
  return (
    <article className="card overflow-hidden transition hover:border-ink-300">
      <div className="flex gap-4 p-4">
        <Link href={href} className="focus-ring rounded-xl">
          <ContentThumb
            url={previewUrl}
            type={content.type}
            alt={content.title}
            className="size-[84px] sm:size-24"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* No celular o badge vai para baixo: lado a lado o titulo some. */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <Link href={href} className="focus-ring min-w-0 rounded">
              <h3 className="truncate text-[15px] font-semibold text-ink-900">{content.title}</h3>
            </Link>
            <ContentStatusBadge status={content.status} locale={locale} className="shrink-0 self-start" />
          </div>

          <p className="text-sm text-ink-500">
            {typeLabel}
            {clientName ? <span className="text-ink-300"> · </span> : null}
            {clientName}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden />
              {content.scheduled_date
                ? formatDate(content.scheduled_date, intlLocale(locale))
                : dict.content.noScheduledDate}
            </span>
            {content.type === "carousel" ? (
              <span className="inline-flex items-center gap-1.5">
                <Layers className="size-3.5" aria-hidden />
                {fileCount} {fileCount === 1 ? dict.contentType.slide : dict.contentType.slides}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {actions ? (
        <div className="border-t border-line bg-ink-50/60 px-4 py-3">{actions}</div>
      ) : null}
    </article>
  );
}
