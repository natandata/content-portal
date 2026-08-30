import type { Metadata } from "next";

import { InvoicesList } from "@/features/workspace/invoices-list";

export const metadata: Metadata = { title: "Cobrancas" };

export default function Page() {
  return <InvoicesList />;
}
