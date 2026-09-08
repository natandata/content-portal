import { NextResponse } from "next/server";

import { cronSecret } from "@/lib/env";
import { reconcileAutentiqueDocuments } from "@/server/autentique/reconcile";

/**
 * Roda uma vez por dia (Vercel Cron -- ver vercel.json). Rede de seguranca
 * do webhook global do Autentique (`api/webhooks/autentique`): confirma
 * direto com a API de todo documento `sent_for_signature` que ainda nao
 * fechou por webhook -- cobre o caso do webhook nao estar configurado
 * direito ou uma entrega ter se perdido.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = cronSecret();
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const result = await reconcileAutentiqueDocuments();
  return NextResponse.json({ ok: true, ...result });
}
