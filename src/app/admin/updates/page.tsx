import type { Metadata } from "next";

import { VotesReport } from "@/components/bulletin/votes-report";
import { BulletinBoard } from "@/features/bulletin/bulletin-board";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { loadBulletinAdminReport } from "@/server/queries";

export const metadata: Metadata = { title: "Mural" };

// Area da equipe fica sempre em portugues — nao usar o cookie de locale
// (esse e so para a area do cliente).
export default async function Page() {
  await requireAdmin();
  const supabase = await createClient();
  const locale = DEFAULT_LOCALE;
  const report = await loadBulletinAdminReport(supabase);

  return (
    <>
      <BulletinBoard supabase={supabase} isAdmin locale={locale} />
      <VotesReport report={report} locale={locale} />
    </>
  );
}
