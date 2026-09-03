import type { Metadata } from "next";

import { PaymentAccountSettings } from "@/features/workspace/payment-account-settings";

export const metadata: Metadata = { title: "Receber pagamento online" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; refresh?: string }>;
}) {
  const { done } = await searchParams;
  return <PaymentAccountSettings justReturned={done === "1"} />;
}
