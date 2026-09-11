import { z } from "zod";

import { completeMultimodal, type ContentBlock } from "@/lib/anthropic/client";
import { anthropicConfig } from "@/lib/env";
import { BUCKETS } from "@/lib/paths";
import { signedUrl } from "@/lib/storage";
import type { createAdminClient } from "@/lib/supabase/server";
import type { ContentType } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

const IDEA_COUNT = 20;

const ideaSchema = z.object({
  title: z.string().trim().min(2),
  type: z.enum(["image", "video", "carousel"]),
  onScreenText: z.string().trim().min(1),
  caption: z.string().trim().min(1),
});
const ideasSchema = z.array(ideaSchema).min(10).max(IDEA_COUNT);

const SYSTEM_PROMPT = `Voce e um estrategista de conteudo de uma agencia, criando ideias de post pra
Instagram inspiradas em perfis de referencia, adaptadas pro nicho e tom de
voz de um cliente especifico. Analise a bio e os posts recentes (imagem e
legenda) de cada perfil de referencia, o relatorio de metricas anexado e o
Banco de Referencias do cliente pra identificar formatos e ganchos que
funcionam. Nao copie legendas nem textos -- adapte a IDEIA (tema, formato,
estrutura do gancho) pra realidade do cliente.

Devolva SOMENTE um array JSON com exatamente 20 objetos, sem nenhum texto
antes ou depois, no formato:
[{"title": "...", "type": "image"|"video"|"carousel", "onScreenText": "...", "caption": "..."}]

"title" e um titulo curto interno (nome do rascunho, nao aparece pro
cliente final). "onScreenText" e o texto que aparece NA TELA (capa do
carrossel, texto sobreposto no video/imagem). "caption" e a legenda
completa que acompanha a publicacao. Tom direto, sem jargao de IA
("crucial", "mergulhar fundo", "desvendar", "imperativo",
"revolucionario" -- proibidos).`;

/**
 * Gera as 20 ideias de conteudo e ja cria os rascunhos em `contents`.
 * Chamada pela rota de webhook do Apify assim que os dois scrapes (bio +
 * posts) terminam -- nunca falha silenciosamente: qualquer erro marca a
 * geracao como `failed` com a mensagem, sem deixar rascunho pela metade.
 */
export async function generateContentIdeas(admin: AdminClient, generationId: string): Promise<void> {
  const { data: generation } = await admin
    .from("content_idea_generations")
    .select("*")
    .eq("id", generationId)
    .maybeSingle();

  if (!generation) return;

  const fail = async (message: string) => {
    await admin
      .from("content_idea_generations")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", generationId)
      .eq("status", "analyzing");
  };

  const config = anthropicConfig();
  if (!config) return fail("Geracao de conteudo por IA nao foi configurada nesta instalacao.");

  const supabase = admin;
  const { data: client } = await supabase
    .from("clients")
    .select("company_name, tag")
    .eq("id", generation.client_id)
    .maybeSingle();
  if (!client) return fail("Cliente nao encontrado.");

  const { data: branding } = await supabase
    .from("client_branding")
    .select("voice_tone, target_audience, value_proposition, content_pillars")
    .eq("client_id", generation.client_id)
    .maybeSingle();

  const { data: references } = await supabase
    .from("client_references")
    .select("title, url, format")
    .eq("client_id", generation.client_id)
    .order("position");

  // Relatorio e opcional -- quando enviado, entra como bloco de imagem/documento;
  // sem ele, a IA trabalha so com os perfis de referencia e o branding.
  const reportUrl = generation.report_file_path
    ? await signedUrl(supabase, BUCKETS.contentIdeaReports, generation.report_file_path)
    : null;

  const usernames = [generation.client_username, ...generation.reference_usernames];
  const summary = (generation.profiles_summary ?? {}) as Record<string, Record<string, unknown>>;
  const posts = (generation.profiles_posts ?? {}) as Record<string, Record<string, unknown>[]>;

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

  const referencesContext = (references ?? [])
    .map((ref) => `- ${ref.title} (${ref.format === "video" ? "video" : "imagem/estatico"}): ${ref.url}`)
    .join("\n");

  const content: ContentBlock[] = [
    {
      type: "text",
      text: [
        `Cliente: ${client.company_name}${client.tag ? ` (nicho/segmento: ${client.tag})` : ""}`,
        brandContext ? `\nContexto da marca:\n${brandContext}` : null,
        referencesContext ? `\nBanco de Referencias (inspiracao ja curada pela equipe):\n${referencesContext}` : null,
        reportUrl ? `\nRelatorio de metricas dos ultimos 3 meses (anexado a seguir):` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  if (reportUrl && generation.report_file_path) {
    content.push({
      type: generation.report_file_path.toLowerCase().endsWith(".pdf") ? "document" : "image",
      source: { type: "url", url: reportUrl },
    });
  }

  for (const username of usernames) {
    const isClient = username === generation.client_username;
    const bio = summary[username];
    content.push({
      type: "text",
      text: `\n${isClient ? "PERFIL DO CLIENTE" : "PERFIL DE REFERENCIA"}: @${username}${
        bio ? `\nBio: ${String(bio.biography ?? bio.bio ?? "")}\nSeguidores: ${String(bio.followersCount ?? bio.followers ?? "?")}` : ""
      }`,
    });

    const profilePosts = (posts[username] ?? []).slice(0, 9);
    for (const post of profilePosts) {
      const caption = String(post.caption ?? "");
      const imageUrl = String(post.displayUrl ?? post.imageUrl ?? "");
      content.push({ type: "text", text: `Post de @${username} -- legenda: ${caption || "(sem legenda)"}` });
      if (imageUrl) content.push({ type: "image", source: { type: "url", url: imageUrl } });
    }
  }

  content.push({
    type: "text",
    text: `\nGere ${IDEA_COUNT} ideias de post inspiradas nos perfis de referencia acima, adaptadas
pro cliente ${client.company_name}. Devolva SO o array JSON, nada mais.`,
  });

  const result = await completeMultimodal(config.apiKey, {
    system: SYSTEM_PROMPT,
    content,
    maxTokens: 8000,
  });
  if (!result.ok) return fail(result.error);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonArray(result.data));
  } catch {
    return fail("A IA nao devolveu um JSON valido.");
  }

  const parsed = ideasSchema.safeParse(parsedJson);
  if (!parsed.success) return fail("A IA devolveu ideias em formato inesperado.");

  const ideas = parsed.data.slice(0, IDEA_COUNT);

  const { data: created, error: insertError } = await admin
    .from("contents")
    .insert(
      ideas.map((idea) => ({
        client_id: generation.client_id,
        title: idea.title,
        type: idea.type as ContentType,
        description: idea.onScreenText,
        caption: idea.caption,
      })),
    )
    .select("id");

  if (insertError || !created) {
    return fail(`Ideias geradas, mas nao foi possivel criar os rascunhos: ${insertError?.message ?? "erro desconhecido"}`);
  }

  await admin
    .from("content_idea_generations")
    .update({
      status: "done",
      generated_ideas: ideas,
      created_content_ids: created.map((row) => row.id),
      completed_at: new Date().toISOString(),
    })
    .eq("id", generationId)
    .eq("status", "analyzing");
}

/** A IA pode envolver o JSON em ```json ou texto solto apesar da instrucao -- extrai so o array. */
function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}
