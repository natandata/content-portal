"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { BRAND_ARCHETYPES } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";
import type { BrandArchetype } from "@/types/database";

const longText = () =>
  z
    .string()
    .trim()
    .max(2000, "Maximo de 2000 caracteres.")
    .transform((value) => value || null)
    .nullish()
    .transform((value) => value ?? null);

const brandingSchema = z.object({
  clientId: z.uuid(),
  essencePersona: longText(),
  essenceDefends: longText(),
  essenceRejects: longText(),
  essenceMissed: longText(),
  essenceWord: longText(),
  archetype: z
    .enum(BRAND_ARCHETYPES as [string, ...string[]])
    .nullish()
    .transform((value) => value ?? null),
  archetypeNotes: longText(),
  voiceTone: longText(),
  colorPalette: longText(),
  typography: longText(),
  visualReferences: longText(),
  targetAudience: longText(),
  valueProposition: longText(),
  differentiators: longText(),
  contentPillars: longText(),
});

/** Grava o branding inteiro de uma vez — upsert porque a linha so nasce no primeiro save. */
export async function saveClientBrandingAction(
  input: z.input<typeof brandingSchema>,
): Promise<ActionResult<null>> {
  await requireStaff();

  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("client_branding").upsert(
    {
      client_id: data.clientId,
      essence_persona: data.essencePersona,
      essence_defends: data.essenceDefends,
      essence_rejects: data.essenceRejects,
      essence_missed: data.essenceMissed,
      essence_word: data.essenceWord,
      archetype: data.archetype as BrandArchetype | null,
      archetype_notes: data.archetypeNotes,
      voice_tone: data.voiceTone,
      color_palette: data.colorPalette,
      typography: data.typography,
      visual_references: data.visualReferences,
      target_audience: data.targetAudience,
      value_proposition: data.valueProposition,
      differentiators: data.differentiators,
      content_pillars: data.contentPillars,
    },
    { onConflict: "client_id" },
  );

  if (error) {
    return fail(describeError(error, "Nao foi possivel salvar o branding."));
  }

  revalidatePath(`/admin/clients/${data.clientId}`);
  revalidatePath(`/professional/clients/${data.clientId}`);
  return done();
}
