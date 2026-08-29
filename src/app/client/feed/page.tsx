import type { Metadata } from "next";

import { ClientFeed } from "@/features/client/feed";

export const metadata: Metadata = { title: "Feed" };

export default function Page() {
  return <ClientFeed />;
}
