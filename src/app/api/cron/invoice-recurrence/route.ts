import { NextResponse } from "next/server";

import { cronSecret } from "@/lib/env";
import { generateDueInvoiceRecurrences } from "@/server/invoices/recurrence";

/**
 * Roda uma vez por dia (Vercel Cron -- ver vercel.json) e gera o proximo
 * ciclo de cada cobranca recorrente cujo vencimento se aproxima -- mesmos 5
 * dias de antecedencia do cron de lembrete (`invoice-reminders`). Uma serie
 * "3_months"/"6_months" para sozinha depois do total de ciclos; "monthly"
 * nunca para sozinha (so via `cancelInvoiceRecurrenceAction`, no app).
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = cronSecret();
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const result = await generateDueInvoiceRecurrences();
  return NextResponse.json({ ok: true, ...result });
}
