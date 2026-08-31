"use server";

import { revalidateTag } from "next/cache";

/**
 * Revalida o cache de badges quando o usuário acessa a página de payments.
 * Isso faz o badge de "Cobrancas" desaparecer da navegação.
 */
export async function revalidateBadgesCache() {
  revalidateTag("nav-badges");
}
