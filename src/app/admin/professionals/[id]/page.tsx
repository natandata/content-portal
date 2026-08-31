import type { Metadata } from "next";

import { ProfessionalDetail } from "@/features/workspace/professional-detail";

export const metadata: Metadata = { title: "Profissional" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfessionalDetail professionalId={id} />;
}
