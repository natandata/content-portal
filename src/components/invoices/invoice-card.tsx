import type { ReactNode } from "react";
import { Banknote, Link2, QrCode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/layout";
import { dueDateLabel, formatMoney, INVOICE_METHOD_LABEL } from "@/lib/domain";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/utils";
import type { InvoiceRow } from "@/types/database";

const METHOD_ICON = { boleto: Banknote, link: Link2, pix: QrCode } as const;

/**
 * Um cartao de cobranca — usado tanto na listagem da equipe quanto na do
 * cliente. `clientName` so aparece quando fornecido (a listagem da equipe
 * junta todos os clientes; a do cliente ja sabe quem e).
 */
export function InvoiceCard({
  invoice,
  clientName,
  locale = DEFAULT_LOCALE,
  primaryAction,
  secondaryActions,
}: {
  invoice: InvoiceRow;
  clientName?: string;
  locale?: Locale;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
}) {
  const Icon = METHOD_ICON[invoice.method];
  const due = dueDateLabel(invoice.due_date, invoice.status);

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-ink-900">{invoice.title}</h3>
            <Badge tone="neutral">
              <Icon className="size-3.5" aria-hidden />
              {INVOICE_METHOD_LABEL[invoice.method]}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-500">
            {clientName ? (
              <>
                {clientName}
                <span className="text-ink-300"> · </span>
              </>
            ) : null}
            Vencimento em {formatDate(invoice.due_date, intlLocale(locale))}
          </p>
          <p className="mt-1 text-lg font-semibold text-ink-900 tabular-nums">
            {formatMoney(invoice.amount, invoice.currency, locale)}
          </p>
        </div>

        <Badge tone={due.tone} className="shrink-0">
          {due.text}
        </Badge>
      </div>

      {primaryAction ? (
        <div className="border-t border-line px-5 py-3">{primaryAction}</div>
      ) : null}

      {secondaryActions ? (
        <div className="border-t border-line bg-ink-50/60 px-5 py-3">{secondaryActions}</div>
      ) : null}
    </Card>
  );
}
