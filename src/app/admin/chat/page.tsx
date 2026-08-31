import type { Metadata } from "next";

import { StaffChatInbox } from "@/features/workspace/staff-chat-inbox";

export const metadata: Metadata = { title: "Chat" };

export default function Page() {
  return <StaffChatInbox />;
}
