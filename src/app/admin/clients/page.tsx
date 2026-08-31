import type { Metadata } from "next";

import { ClientsList } from "@/features/workspace/clients-list";

export const metadata: Metadata = { title: "Clientes" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ professional?: string }>;
}) {
  const { professional } = await searchParams;
  return <ClientsList professionalId={professional} />;
}
