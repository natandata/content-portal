import "server-only";

import { twilioConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Notificacao via WhatsApp Business API (Twilio) -- canal adicional ao push
 * notification (`lib/push.ts`), nao um substituto: nem todo cliente instala
 * o app como PWA, mas quase todo mundo confere o WhatsApp. Mesmo padrao de
 * "falha silenciosa sem config" das outras integracoes -- nunca derruba a
 * acao que disparou o aviso.
 *
 * IMPORTANTE (restricao da propria Meta, nao deste codigo): mensagem de
 * WhatsApp Business iniciada pela empresa (nao em resposta a uma mensagem
 * do cliente nas ultimas 24h) exige um "template" pre-aprovado pela Meta --
 * texto livre (`Body` solto) so funciona dentro da janela de 24h de uma
 * conversa iniciada pelo cliente. Pra notificacao proativa (lembrete de
 * cobranca, aviso de conteudo pronto) funcionar sempre, o numero da Twilio
 * precisa ter pelo menos um template de mensagem aprovado -- isso e feito
 * no painel da Twilio/Meta, fora do alcance deste codigo.
 */

function toE164(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  // Numero brasileiro sem DDI -- assume +55. Numero ja com DDI (11+ digitos
  // comecando por codigo de pais) passa direto.
  if (digits.length <= 11) return `+55${digits}`;
  return `+${digits}`;
}

async function sendWhatsAppMessage(toPhone: string, body: string): Promise<void> {
  const config = twilioConfig();
  if (!config) return;

  const to = toE164(toPhone);
  if (!to) return;

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const params = new URLSearchParams({
    From: config.whatsappFrom,
    To: `whatsapp:${to}`,
    Body: body,
  });

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  }).catch(() => {});
}

/** Manda uma mensagem de WhatsApp pro telefone cadastrado do cliente. Sem telefone, e um no-op silencioso. */
export async function sendWhatsAppToClient(clientId: string, body: string): Promise<void> {
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("phone").eq("id", clientId).maybeSingle();
  if (!client?.phone) return;

  await sendWhatsAppMessage(client.phone, body);
}
