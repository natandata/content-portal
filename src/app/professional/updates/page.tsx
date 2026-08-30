import type { Metadata } from "next";

import { BulletinBoard } from "@/features/bulletin/bulletin-board";
import { requireStaff } from "@/lib/auth";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mural" };

// Area da equipe fica sempre em portugues — nao usar o cookie de locale
// (esse e so para a area do cliente).
export default async function Page() {
  await requireStaff();
  const supabase = await createClient();
  const locale = DEFAULT_LOCALE;

  return <BulletinBoard supabase={supabase} isAdmin={false} locale={locale} />;
}
