import type { Metadata } from "next";

import { ClientChat } from "@/features/client/chat";

export const metadata: Metadata = { title: "Chat" };

export default function Page() {
  return <ClientChat />;
}
