import type { Metadata } from "next";

import { ApprovalsList } from "@/features/workspace/approvals-list";

export const metadata: Metadata = { title: "Aprovacoes" };

export default function Page() {
  return <ApprovalsList />;
}
