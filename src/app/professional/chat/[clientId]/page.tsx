import type { Metadata } from "next";

import { StaffChatThread } from "@/features/workspace/chat-thread";

export const metadata: Metadata = { title: "Chat" };

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <StaffChatThread clientId={clientId} />;
}
