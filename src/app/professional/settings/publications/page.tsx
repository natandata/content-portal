import type { Metadata } from "next";

import { PublicationsSettings } from "@/features/workspace/publications-settings";

export const metadata: Metadata = { title: "Publicacoes" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <PublicationsSettings clientId={client} />;
}
