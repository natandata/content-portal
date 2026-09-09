import { sendDueInvoiceReminders } from "../../src/server/invoices/reminders";

async function main() {
  const { checked, sent } = await sendDueInvoiceReminders();
  console.log(`[invoice-reminders] checked=${checked} sent=${sent}`);
}

// Sem process.exit(0) no sucesso de proposito -- ver comentario em
// autentique-reconcile.ts (crash de libuv no Windows com saida forcada).
main().catch((err) => {
  console.error("[invoice-reminders] failed:", err);
  process.exit(1);
});
