import type { Metadata } from "next";

import { StaffChatThreadPage } from "@/features/workspace/staff-chat-thread-page";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Chat com o administrador" };

export default async function Page() {
  const actor = await requireStaff();
  return <StaffChatThreadPage professionalId={actor.authUser.id} />;
}
