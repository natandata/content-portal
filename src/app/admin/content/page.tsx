import type { Metadata } from "next";

import { ContentsList } from "@/features/workspace/contents-list";

export const metadata: Metadata = { title: "Conteudos" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; status?: string; professional?: string }>;
}) {
  const { client, status, professional } = await searchParams;
  return <ContentsList clientId={client} status={status} professionalId={professional} />;
}
