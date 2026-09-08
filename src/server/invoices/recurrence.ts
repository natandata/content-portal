import "server-only";

import { daysUntil } from "@/lib/domain";
import { intlLocale } from "@/lib/i18n/locale";
import { sendPushToClient, sendPushToClientStaff } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/server";
import { logClientActivity } from "@/server/activity";
import { revalidateInvoices } from "@/server/invoices/revalidate";
import type { InvoiceRow } from "@/types/database";

/**
 * Gera o proximo ciclo de cada cobranca recorrente que esta perto do
 * vencimento -- nao e "use server" de proposito (roda so a partir do cron,
 * sem sessao de staff nenhuma), mesmo espirito de
 * `instagram-insights-report.ts`/`autentique/reconcile.ts`.
 *
 * So copia colunas -- nenhum metodo de cobranca (boleto/link/pix/stripe)
 * precisa de uma chamada de API pra "criar" a cobranca em si (confirmado
 * lendo `createInvoiceAction`: `stripe_account_id` e' resolvido uma vez e
 * reaproveitado, o link/chave Pix sao so texto). So o boleto tem um arquivo
 * de verdade, que nunca e copiado -- o ciclo novo nasce sem PDF, staff
 * anexa depois (decisao do usuario), e por isso o cliente so e avisado nos
 * outros metodos; no boleto quem recebe o aviso e' o staff mesmo.
 */

const LOOKAHEAD_DAYS = 5; // mesmo prazo de antecedencia do cron de lembrete de cobranca
const MAX_OVERDUE_DAYS = 30; // serie muito atrasada (cliente sumiu) para de gerar sozinha

function addMonthsIso(dateIso: string, months: number): string {
  const parts = dateIso.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

function formatDatePtBr(dateIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(
    new Date(`${dateIso}T12:00:00Z`),
  );
}

async function notifyNewCycle(invoice: InvoiceRow) {
  if (invoice.method === "boleto") {
    // Sem arquivo ainda -- avisa quem precisa agir (staff), nao o cliente.
    await sendPushToClientStaff(invoice.client_id, {
      title: "Novo ciclo de cobranca recorrente",
      body: `"${invoice.title}" -- anexe o boleto do proximo ciclo (vencimento em ${formatDatePtBr(invoice.due_date)}).`,
      url: "/professional/payments",
      tag: `invoice-recurrence-${invoice.id}`,
    }).catch(() => {});
    return;
  }

  await sendPushToClient(invoice.client_id, (locale) => {
    const dueLabel = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short", timeZone: "UTC" }).format(
      new Date(`${invoice.due_date}T12:00:00Z`),
    );
    return locale === "en"
      ? {
          title: "New invoice",
          body: `"${invoice.title}" is due on ${dueLabel}.`,
          url: "/client/payments",
          tag: `invoice-${invoice.id}`,
        }
      : {
          title: "Nova cobranca",
          body: `"${invoice.title}" chegou -- vencimento em ${dueLabel}.`,
          url: "/client/payments",
          tag: `invoice-${invoice.id}`,
        };
  }).catch(() => {});
}

export async function generateDueInvoiceRecurrences(limit = 30): Promise<{ checked: number; generated: number }> {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("invoices")
    .select("*")
    .not("recurrence_group_id", "is", null)
    .order("recurrence_group_id", { ascending: true })
    .order("recurrence_cycle_number", { ascending: false });

  // So a linha mais recente (maior cycle_number) de cada grupo importa --
  // e' a partir dela que decidimos se ja e' hora do proximo ciclo.
  const latestByGroup = new Map<string, InvoiceRow>();
  for (const row of rows ?? []) {
    if (row.recurrence_group_id && !latestByGroup.has(row.recurrence_group_id)) {
      latestByGroup.set(row.recurrence_group_id, row);
    }
  }

  let checked = 0;
  let generated = 0;
  const touchedClients = new Set<string>();

  for (const latest of latestByGroup.values()) {
    if (checked >= limit) break;
    checked += 1;

    if (latest.recurrence_cancelled) continue;
    if (latest.recurrence_total_cycles != null && (latest.recurrence_cycle_number ?? 1) >= latest.recurrence_total_cycles) {
      continue; // serie ja completou todos os ciclos
    }

    const nextDueDate = addMonthsIso(latest.due_date, 1);
    const diff = daysUntil(nextDueDate);
    if (diff > LOOKAHEAD_DAYS) continue; // ainda nao chegou a janela de antecedencia
    if (diff < -MAX_OVERDUE_DAYS) continue; // muito atrasado -- nao acumula sozinho pra sempre

    const { data: client } = await admin.from("clients").select("status").eq("id", latest.client_id).maybeSingle();
    if (!client || client.status !== "active") continue; // cliente inativo/arquivado -- para de gerar

    const { data: created, error } = await admin
      .from("invoices")
      .insert({
        client_id: latest.client_id,
        title: latest.title,
        method: latest.method,
        amount: latest.amount,
        currency: latest.currency,
        due_date: nextDueDate,
        payment_link: latest.payment_link,
        pix_key: latest.pix_key,
        stripe_account_id: latest.stripe_account_id,
        created_by: latest.created_by,
        recurrence: latest.recurrence,
        recurrence_group_id: latest.recurrence_group_id,
        recurrence_cycle_number: (latest.recurrence_cycle_number ?? 1) + 1,
        recurrence_total_cycles: latest.recurrence_total_cycles,
      })
      .select("*")
      .single();

    if (error || !created) continue;

    generated += 1;
    touchedClients.add(latest.client_id);
    await logClientActivity(
      admin,
      latest.client_id,
      "Recorrencia automatica",
      `Gerou cobranca recorrente "${created.title}"`,
    );
    await notifyNewCycle(created);
  }

  for (const clientId of touchedClients) revalidateInvoices(clientId);
  return { checked, generated };
}
