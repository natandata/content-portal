import { ContentEdit } from "@/features/workspace/content-editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContentEdit contentId={id} />;
}
