import type { Metadata } from "next";

import { IdeasBoard } from "@/features/workspace/ideas-board";

export const metadata: Metadata = { title: "Banco de Ideias" };

export default function Page() {
  return <IdeasBoard />;
}
