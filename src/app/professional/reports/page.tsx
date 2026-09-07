import type { Metadata } from "next";

import { ReportsBoard } from "@/features/workspace/reports-board";

export const metadata: Metadata = { title: "Relatorios" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; error?: string }>;
}) {
  const { client, error } = await searchParams;
  return <ReportsBoard clientId={client} error={error} />;
}
