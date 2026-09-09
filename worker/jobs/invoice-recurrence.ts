import { generateDueInvoiceRecurrences } from "../../src/server/invoices/recurrence";

async function main() {
  const result = await generateDueInvoiceRecurrences();
  console.log(`[invoice-recurrence] checked=${result.checked} generated=${result.generated}`);
}

// Sem process.exit(0) no sucesso de proposito -- ver comentario em
// autentique-reconcile.ts (crash de libuv no Windows com saida forcada).
main().catch((err) => {
  console.error("[invoice-recurrence] failed:", err);
  process.exit(1);
});
