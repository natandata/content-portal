import type { Metadata } from "next";

import { AdminDashboard } from "@/features/workspace/admin-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <AdminDashboard />;
}
