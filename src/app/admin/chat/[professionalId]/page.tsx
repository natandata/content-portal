import type { Metadata } from "next";

import { StaffChatThreadPage } from "@/features/workspace/staff-chat-thread-page";

export const metadata: Metadata = { title: "Chat" };

export default async function Page({
  params,
}: {
  params: Promise<{ professionalId: string }>;
}) {
  const { professionalId } = await params;
  return <StaffChatThreadPage professionalId={professionalId} />;
}
