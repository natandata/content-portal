import { ClientDetailTabs } from "@/components/clients/client-detail-tabs";
import { RevalidateInvoicesBadge } from "@/components/payments/revalidate-invoices-badge";
import { ClientDocuments } from "@/features/client/documents";
import { ClientInvoices } from "@/features/client/invoices";
import { getServerDictionary } from "@/lib/i18n/server";

export type DocumentsHubTab = "documents" | "payments";

/**
 * Documentos e Cobrancas viviam em 2 itens separados no menu do cliente —
 * reduzido a um so, com abas: os dois sao "coisas que o profissional manda
 * para o cliente ler/pagar", faz sentido morarem juntos.
 *
 * A rota antiga (`/client/payments`) continua existindo e cai aqui com a
 * aba certa ja selecionada — links de pagamento por notificacao push
 * continuam funcionando.
 */
export async function ClientDocumentsHub({ defaultTab = "documents" }: { defaultTab?: DocumentsHubTab }) {
  const { dict } = await getServerDictionary();

  return (
    <ClientDetailTabs
      defaultTab={defaultTab}
      tabs={[
        { id: "documents", label: dict.nav.documents, content: <ClientDocuments /> },
        {
          id: "payments",
          label: dict.nav.payments,
          content: (
            <>
              <RevalidateInvoicesBadge />
              <ClientInvoices />
            </>
          ),
        },
      ]}
    />
  );
}
