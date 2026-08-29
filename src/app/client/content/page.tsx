import type { Metadata } from "next";

import { ClientContents } from "@/features/client/contents";

export const metadata: Metadata = { title: "Conteudos" };

export default function Page() {
  return <ClientContents />;
}
