import type { Metadata } from "next";

import { ApprovalsList } from "@/features/workspace/approvals-list";

export const metadata: Metadata = { title: "Aprovacoes" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ professional?: string }>;
}) {
  const { professional } = await searchParams;
  return <ApprovalsList professionalId={professional} />;
}
