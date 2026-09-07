import type { Metadata } from "next";

import { MeetingsOverview } from "@/features/workspace/meetings-overview";

export const metadata: Metadata = { title: "Reunioes" };

export default function Page() {
  return <MeetingsOverview />;
}
