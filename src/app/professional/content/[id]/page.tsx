import { ContentDetail } from "@/features/workspace/content-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContentDetail contentId={id} />;
}
