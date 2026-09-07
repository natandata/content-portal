import { ClientDetail } from "@/features/workspace/client-detail";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <ClientDetail clientId={id} defaultTab={tab} />;
}
