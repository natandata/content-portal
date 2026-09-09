import { NextResponse } from "next/server";

import { cronSecret } from "@/lib/env";
import { sendDueInvoiceReminders } from "@/server/invoices/reminders";

/**
 * Roda uma vez por dia (Vercel Cron — ver vercel.json). Logica de fato em
 * `server/invoices/reminders.ts`, compartilhada com o worker do Railway.
 */
export async function GET(request: Request) {
  const secret = cronSecret();
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { checked, sent } = await sendDueInvoiceReminders();
  return NextResponse.json({ ok: true, checked, sent });
}
