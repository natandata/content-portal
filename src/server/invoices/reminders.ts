import "server-only";

import { daysUntil } from "@/lib/domain";
import { intlLocale } from "@/lib/i18n/locale";
import { sendPushToClient } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppToClient } from "@/lib/whatsapp";

/**
 * Pra cada cobranca em aberto, manda um lembrete ao cliente:
 *   - 5 dias antes do vencimento
 *   - no dia do vencimento
 *   - todo santo dia depois de vencida
 *
 * `last_reminder_sent_on` evita duplicar o aviso se rodar duas vezes no
 * mesmo dia (retry, disparo manual em teste, etc). Extraido da rota
 * (`api/cron/invoice-reminders`) pra ter o mesmo formato dos outros jobs
 * compartilhados (`reconcile.ts`, `recurrence.ts`) -- assim tanto a rota da
 * Vercel quanto o worker do Railway chamam a mesma logica.
 */
export async function sendDueInvoiceReminders(): Promise<{ checked: number; sent: number }> {
  const admin = createAdminClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const { data: invoices, error } = await admin
    .from("invoices")
    .select("id, client_id, title, due_date, last_reminder_sent_on")
    .eq("status", "open");

  if (error) throw new Error(error.message);

  const clientIds = [...new Set((invoices ?? []).map((invoice) => invoice.client_id))];
  const { data: clients } = clientIds.length
    ? await admin.from("clients").select("id, preferred_locale").in("id", clientIds)
    : { data: [] as { id: string; preferred_locale: string }[] };
  const localeByClient = new Map((clients ?? []).map((client) => [client.id, client.preferred_locale]));

  let sent = 0;

  for (const invoice of invoices ?? []) {
    if (invoice.last_reminder_sent_on === today) continue;

    const diff = daysUntil(invoice.due_date);
    if (diff !== 5 && diff !== 0 && diff >= 0) continue;

    const en = localeByClient.get(invoice.client_id) === "en";
    const due = new Date(`${invoice.due_date}T12:00:00Z`);
    const dueLabel = new Intl.DateTimeFormat(intlLocale(en ? "en" : "pt-BR"), {
      dateStyle: "short",
      timeZone: "UTC",
    }).format(due);

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

    await Promise.all([
      sendPushToClient(invoice.client_id, { ...notice, url: "/client/payments", tag: `invoice-${invoice.id}` }).catch(
        () => {},
      ),
      sendWhatsAppToClient(invoice.client_id, `${notice.title}\n${notice.body}`).catch(() => {}),
    ]);

    await admin.from("invoices").update({ last_reminder_sent_on: today }).eq("id", invoice.id);
    sent += 1;
  }

  return { checked: invoices?.length ?? 0, sent };
}
