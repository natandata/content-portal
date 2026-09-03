import type { Metadata } from "next";

import { ReportsBoard } from "@/features/workspace/reports-board";

export const metadata: Metadata = { title: "Relatorios" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <ReportsBoard clientId={client} />;
}
