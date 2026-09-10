import type { Metadata } from "next";

import { PublicationsSettings } from "@/features/workspace/publications-settings";

export const metadata: Metadata = { title: "Publicacoes" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; professional?: string }>;
}) {
  const { client, professional } = await searchParams;
  return <PublicationsSettings clientId={client} professionalId={professional} />;
}
