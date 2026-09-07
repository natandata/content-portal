import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { runInstagramInsightsReport } from "@/server/actions/instagram-insights-report";
import { createClient } from "@/lib/supabase/server";

/**
 * Coleta sincrona dos insights autenticados (relatorio 2) -- rota, e nao uma
 * server action comum, so para poder declarar `maxDuration` maior (ver
 * plano, Etapa 4). Chamada pelo formulario de insights via fetch.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  clientId: z.uuid(),
  periodMonths: z.union([z.literal(3), z.literal(6), z.literal(9)]),
});

export async function POST(request: Request) {
  const actor = await requireStaff().catch(() => null);
  if (!actor) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  // RLS confirma que o ator pode ver este cliente antes de qualquer chamada na Composio.
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });

  const result = await runInstagramInsightsReport({
    clientId: parsed.data.clientId,
    periodMonths: parsed.data.periodMonths,
    requestedBy: actor.authUser.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  revalidatePath("/professional/reports");
  return NextResponse.json({ ok: true, data: result.data });
}
