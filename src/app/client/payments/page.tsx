import type { Metadata } from "next";

import { RevalidateInvoicesBadge } from "@/components/payments/revalidate-invoices-badge";
import { ClientInvoices } from "@/features/client/invoices";
import { getServerDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerDictionary();
  return { title: dict.nav.payments };
}

export default function Page() {
  return (
    <>
      <RevalidateInvoicesBadge />
      <ClientInvoices />
    </>
  );
}
