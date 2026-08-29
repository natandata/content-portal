import type { Metadata } from "next";

import { ContentCreate } from "@/features/workspace/content-editor";

export const metadata: Metadata = { title: "Novo conteudo" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <ContentCreate defaultClientId={client} />;
}
