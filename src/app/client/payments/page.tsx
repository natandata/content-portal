import type { Metadata } from "next";

import { RevalidateInvoicesBadge } from "@/components/payments/revalidate-invoices-badge";
import { ClientInvoices } from "@/features/client/invoices";

export const metadata: Metadata = { title: "Cobrancas" };

export default function Page() {
  return (
    <>
      <RevalidateInvoicesBadge />
      <ClientInvoices />
    </>
  );
}
