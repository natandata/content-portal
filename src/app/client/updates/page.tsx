import type { Metadata } from "next";

import { BulletinBoard } from "@/features/bulletin/bulletin-board";
import { requireClientActor } from "@/lib/auth";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.bulletin.dashboardTitle };
}

export default async function Page() {
  await requireClientActor();
  const supabase = await createClient();
  const { locale } = await getServerDictionary();

  return <BulletinBoard supabase={supabase} isAdmin={false} locale={locale} />;
}
