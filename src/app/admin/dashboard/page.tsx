import type { Metadata } from "next";

import { WorkspaceDashboard } from "@/features/workspace/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <WorkspaceDashboard />;
}
