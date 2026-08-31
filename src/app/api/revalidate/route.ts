import { revalidateTag } from "next/cache";

/**
 * Endpoint para revalidar caches de tags específicas.
 * Chamado via fetch client-side para atualizar badges após navegação.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");

  if (!tag) {
    return Response.json({ error: "Tag not provided" }, { status: 400 });
  }

  revalidateTag(tag);
  return Response.json({ revalidated: true, tag });
}
