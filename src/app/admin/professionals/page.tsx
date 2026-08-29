import type { Metadata } from "next";

import { ProfessionalsList } from "@/features/workspace/professionals-list";

export const metadata: Metadata = { title: "Profissionais" };

export default function Page() {
  return <ProfessionalsList />;
}
