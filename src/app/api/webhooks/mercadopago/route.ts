import { NextResponse } from "next/server";

import { mercadoPagoConfig } from "@/lib/env";
import { getPayment, verifyWebhookSignature } from "@/lib/mercadopago/client";
import { createAdminClient } from "@/lib/supabase/server";
import { markInvoicePaidFromMercadoPago } from "@/server/invoices/mark-paid";

/**
 * Webhook do Mercado Pago -- confirma pagamento Pix sem staff precisar
 * marcar na mao. Mesmo espirito do webhook da Stripe: sem segredo
 * configurado, recusa tudo (falha fechado); a assinatura e' quem autentica,
 * nao ha sessao.
 *
 * O corpo so traz `{data: {id}}` -- o pagamento de verdade precisa ser
 * buscado de volta na API (`getPayment`), nunca confiar em valor de dentro
 * do corpo do webhook pra decidir se foi pago.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = mercadoPagoConfig();
  if (!config) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const raw = await request.text();
  let body: { type?: string; data?: { id?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }

  if (body.type !== "payment" || !body.data?.id) {
    // Outros tipos de evento (merchant_order, etc.) -- confirma recebimento sem processar.
    return NextResponse.json({ ok: true });
  }

  const signatureHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!signatureHeader || !requestId) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  const validSignature = verifyWebhookSignature({
    signatureHeader,
    requestId,
    dataId: body.data.id,
    webhookSecret: config.webhookSecret,
  });
  if (!validSignature) {
    return NextResponse.json({ error: "Assinatura invalida" }, { status: 400 });
  }

  const paymentResult = await getPayment(config.accessToken, body.data.id);
  if (!paymentResult.ok || paymentResult.data.status !== "approved" || !paymentResult.data.externalReference) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, client_id, title, amount, paid_at, payer_name, payer_cpf")
    .eq("id", paymentResult.data.externalReference)
    .eq("method", "mercadopago")
    .maybeSingle();

  if (invoice) {
    await markInvoicePaidFromMercadoPago(admin, invoice, String(paymentResult.data.id));
  }

  return NextResponse.json({ ok: true });
}
