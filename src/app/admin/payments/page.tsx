import type { Metadata } from "next";

import { RevalidateInvoicesBadge } from "@/components/payments/revalidate-invoices-badge";
import { InvoicesList } from "@/features/workspace/invoices-list";

export const metadata: Metadata = { title: "Cobrancas" };

export default function Page() {
  return (
    <>
      <RevalidateInvoicesBadge />
      <InvoicesList />
    </>
  );
}
