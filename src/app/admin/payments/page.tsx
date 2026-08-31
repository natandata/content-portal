import type { Metadata } from "next";

import { RevalidateInvoicesBadge } from "@/components/payments/revalidate-invoices-badge";
import { InvoicesList } from "@/features/workspace/invoices-list";

export const metadata: Metadata = { title: "Cobrancas" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; professional?: string }>;
}) {
  const { client, professional } = await searchParams;
  return (
    <>
      <RevalidateInvoicesBadge />
      <InvoicesList clientId={client} professionalId={professional} />
    </>
  );
}
