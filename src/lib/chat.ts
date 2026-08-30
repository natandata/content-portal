import type { ChatLinkTarget, UserRole } from "@/types/database";

/**
 * Resolve o destino de um link de chat para o prefixo de quem esta olhando.
 * O profissional aponta para "um conteudo"; o cliente abre em /client/...,
 * a equipe em /admin/... ou /professional/... — mesmo link, URL diferente.
 */
export function resolveChatLinkHref(
  role: UserRole,
  type: ChatLinkTarget,
  contentId: string | null,
): string {
  const base = role === "client" ? "/client" : role === "admin" ? "/admin" : "/professional";

  switch (type) {
    case "content":
      return contentId ? `${base}/content/${contentId}` : `${base}/content`;
    case "documents":
      return `${base}/documents`;
    case "feed":
      return `${base}/feed`;
    case "dashboard":
    default:
      return `${base}/dashboard`;
  }
}
