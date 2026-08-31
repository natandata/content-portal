import type { Metadata } from "next";

import { DocumentsList } from "@/features/workspace/documents-list";

export const metadata: Metadata = { title: "Documentos" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; professional?: string }>;
}) {
  const { client, professional } = await searchParams;
  return <DocumentsList clientId={client} professionalId={professional} />;
}
