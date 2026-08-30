import type { Metadata } from "next";

import { ChatInbox } from "@/features/workspace/chat-inbox";

export const metadata: Metadata = { title: "Chat" };

export default function Page() {
  return <ChatInbox />;
}
