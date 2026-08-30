import type { Metadata } from "next";

import { ClientInvoices } from "@/features/client/invoices";

export const metadata: Metadata = { title: "Cobrancas" };

export default function Page() {
  return <ClientInvoices />;
}
