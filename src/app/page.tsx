import { redirect } from "next/navigation";

import { getActor, HOME_BY_ROLE } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (!isSupabaseConfigured) redirect("/login");

  const actor = await getActor();
  redirect(actor ? HOME_BY_ROLE[actor.role] : "/login");
}
