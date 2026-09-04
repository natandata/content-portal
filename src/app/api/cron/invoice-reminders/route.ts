import { NextResponse } from "next/server";

import { cronSecret } from "@/lib/env";
import { daysUntil } from "@/lib/domain";
import { intlLocale } from "@/lib/i18n/locale";
import { sendPushToClient } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Roda uma vez por dia (Vercel Cron — ver vercel.json) e manda ao cliente,
 * para cada cobranca em aberto:
 *   - 5 dias antes do vencimento
 *   - no dia do vencimento
 *   - todo santo dia depois de vencida
 *
 * `last_reminder_sent_on` evita duplicar o aviso se o cron rodar duas vezes
 * no mesmo dia (retry da Vercel, disparo manual em teste, etc).
 */
export async function GET(request: Request) {
  const secret = cronSecret();
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const { data: invoices, error } = await admin
    .from("invoices")
    .select("id, client_id, title, due_date, last_reminder_sent_on")
    .eq("status", "open");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;

  for (const invoice of invoices ?? []) {
    if (invoice.last_reminder_sent_on === today) continue;

    const diff = daysUntil(invoice.due_date);
    if (diff !== 5 && diff !== 0 && diff >= 0) continue;

    await sendPushToClient(invoice.client_id, (locale) => {
      const en = locale === "en";
      const due = new Date(`${invoice.due_date}T12:00:00Z`);
      const dueLabel = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short", timeZone: "UTC" }).format(
        due,
      );

      const notice =
        diff === 5
          ? {
              title: en ? "Invoice due in 5 days" : "Cobranca vence em 5 dias",
              body: en ? `"${invoice.title}" is due on ${dueLabel}.` : `"${invoice.title}" vence em ${dueLabel}.`,
            }
          : diff === 0
            ? {
                title: en ? "Invoice due today" : "Cobranca vence hoje",
                body: en ? `"${invoice.title}" is due today.` : `"${invoice.title}" vence hoje.`,
              }
            : {
                title: en ? "Overdue invoice" : "Cobranca vencida",
                body: en
                  ? `"${invoice.title}" was due on ${dueLabel} and is still open.`
                  : `"${invoice.title}" venceu em ${dueLabel} e ainda esta em aberto.`,
              };

      return { ...notice, url: "/client/payments", tag: `invoice-${invoice.id}` };
    }).catch(() => {});

    await admin.from("invoices").update({ last_reminder_sent_on: today }).eq("id", invoice.id);
    sent += 1;
  }

  return NextResponse.json({ ok: true, checked: invoices?.length ?? 0, sent });
}
