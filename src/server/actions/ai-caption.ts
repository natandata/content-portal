"use server";

import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { complete } from "@/lib/anthropic/client";
import { anthropicConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/server/result";

const schema = z.object({
  clientId: z.uuid(),
  title: z.string().trim().min(2),
  type: z.enum(["image", "video", "carousel"]),
  briefing: z.string().trim().max(1000).optional(),
});

const SYSTEM_PROMPT = `Voce e um consultor de marketing de conteudo experiente, escrevendo legendas
pra Instagram/redes sociais de clientes de uma agencia. Tom direto, pratico,
sem jargao de IA (proibido: "crucial", "mergulhar fundo", "desvendar",
"imperativo", "revolucionario"). Frases curtas. Gancho forte na primeira
linha. Nunca use emoji em excesso (no maximo 1-2, se fizer sentido). Devolva
SO o texto da legenda, sem explicacao, sem aspas envolvendo o texto todo.`;

/**
 * Sugere uma legenda pro conteudo, usando o briefing da marca (quando
 * cadastrado em Branding) pra manter o tom de voz do cliente. Best-effort --
 * quem usa sempre pode editar o texto depois, isso e so ponto de partida.
 */
export async function generateCaptionSuggestionAction(
  input: z.input<typeof schema>,
): Promise<ActionResult<string>> {
  await requireStaff();

  const config = anthropicConfig();
  if (!config) return fail("Geracao de legenda por IA ainda nao foi configurada nesta instalacao.");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Dados invalidos.");

  const supabase = await createClient();
  const { data: branding } = await supabase
    .from("client_branding")
    .select("voice_tone, target_audience, value_proposition, content_pillars")
    .eq("client_id", parsed.data.clientId)
    .maybeSingle();

  const brandContext = branding
    ? [
        branding.voice_tone ? `Tom de voz da marca: ${branding.voice_tone}` : null,
        branding.target_audience ? `Publico-alvo: ${branding.target_audience}` : null,
        branding.value_proposition ? `Proposta de valor: ${branding.value_proposition}` : null,
        branding.content_pillars ? `Pilares de conteudo: ${branding.content_pillars}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const prompt = [
    `Titulo/tema do conteudo: ${parsed.data.title}`,
    `Formato: ${parsed.data.type === "video" ? "video/Reel" : parsed.data.type === "carousel" ? "carrossel" : "imagem/foto"}`,
    parsed.data.briefing ? `Briefing adicional: ${parsed.data.briefing}` : null,
    brandContext ? `\nContexto da marca:\n${brandContext}` : null,
    "\nEscreva a legenda.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await complete(config.apiKey, { system: SYSTEM_PROMPT, prompt });
  if (!result.ok) return fail(result.error);

  return ok(result.data);
}
