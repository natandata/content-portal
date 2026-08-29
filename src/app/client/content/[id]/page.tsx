import { ClientContentDetail } from "@/features/client/content-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientContentDetail contentId={id} />;
}
