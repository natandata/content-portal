"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { CURRENCIES, CURRENCY_LABEL, INVOICE_METHODS, INVOICE_METHOD_LABEL } from "@/lib/domain";
import { BUCKETS, invoiceBoletoPath } from "@/lib/paths";
import { uploadToBucket, validateFile } from "@/lib/upload";
import { formatBytes } from "@/lib/utils";
import type { CurrencyCode, InvoiceMethod } from "@/types/database";
import { attachBoletoAction, createInvoiceAction } from "@/server/actions/invoices";

export interface ClientOption {
  id: string;
  companyName: string;
}

export function InvoiceCreateModal({
  clients,
  defaultClientId,
  label = "Nova cobranca",
}: {
  clients: ClientOption[];
  defaultClientId?: string;
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [title, setTitle] = useState("");
  const [method, setMethod] = useState<InvoiceMethod>("boleto");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("BRL");
  const [dueDate, setDueDate] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setTitle("");
    setMethod("boleto");
    setAmount("");
    setCurrency("BRL");
    setDueDate("");
    setPaymentLink("");
    setPixKey("");
    setFile(null);
  }

  async function submit() {
    setError(null);

    if (!clientId) {
      setError("Selecione o cliente.");
      return;
    }
    if (title.trim().length < 2) {
      setError("Informe o titulo da cobranca.");
      return;
    }
    if (!dueDate) {
      setError("Informe a data de vencimento.");
      return;
    }
    if (method === "boleto" && !file) {
      setError("Selecione o PDF do boleto.");
      return;
    }

    setBusy(true);

    try {
      const created = await createInvoiceAction({
        clientId,
        title,
        method,
        amount,
        currency,
        dueDate,
        paymentLink: method === "link" ? paymentLink : undefined,
        pixKey: method === "pix" ? pixKey : undefined,
      });
      if (!created.ok) {
        setError(created.error);
        return;
      }

      if (method === "boleto" && file) {
        const invoice = created.data;
        const path = invoiceBoletoPath(clientId, invoice.id, file.name);
        const upload = await uploadToBucket(BUCKETS.invoices, path, file, "application/pdf");

        if (upload.error) {
          setError(`Nao foi possivel enviar o boleto: ${upload.error}`);
          return;
        }

        const attached = await attachBoletoAction(invoice.id, path);
        if (!attached.ok) {
          setError(attached.error);
          return;
        }
      }

      toast.success("Cobranca enviada ao cliente.");
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Nova cobranca"
        description="O cliente ve isso na aba Cobrancas e recebe um aviso."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Enviar cobranca
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Cliente" htmlFor="invoice-client" required>
            <Select
              id="invoice-client"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={busy || Boolean(defaultClientId)}
            >
              <option value="">Selecione...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.companyName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Titulo" htmlFor="invoice-title" hint='Ex.: "Mensalidade agosto"' required>
            <Input
              id="invoice-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
            />
          </Field>

          <Field
            label="Forma de cobranca"
            htmlFor="invoice-method"
            hint={
              method === "stripe"
                ? "O cliente paga dentro do portal e a cobranca se marca como paga sozinha."
                : undefined
            }
            required
          >
            <Select
              id="invoice-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as InvoiceMethod)}
              disabled={busy}
            >
              {INVOICE_METHODS.map((option) => (
                <option key={option} value={option}>
                  {INVOICE_METHOD_LABEL[option]}
                </option>
              ))}
            </Select>
          </Field>

          {/* Pagamento online liquida em BRL na conta conectada; as outras
              moedas seguem valendo para os metodos manuais. */}
          {method === "stripe" && currency !== "BRL" ? (
            <FormError>Pagamento online aceita apenas cobrancas em BRL.</FormError>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor" htmlFor="invoice-amount" required>
              <Input
                id="invoice-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Moeda" htmlFor="invoice-currency" required>
              <Select
                id="invoice-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
                disabled={busy}
              >
                {CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {CURRENCY_LABEL[option]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Vencimento" htmlFor="invoice-due-date" required>
            <Input
              id="invoice-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={busy}
            />
          </Field>

          {method === "link" ? (
            <Field label="Link de pagamento" htmlFor="invoice-link" hint="http:// ou https://" required>
              <Input
                id="invoice-link"
                value={paymentLink}
                onChange={(event) => setPaymentLink(event.target.value)}
                placeholder="https://..."
                disabled={busy}
              />
            </Field>
          ) : null}

          {method === "pix" ? (
            <Field label="Chave Pix" htmlFor="invoice-pix" required>
              <Textarea
                id="invoice-pix"
                rows={2}
                value={pixKey}
                onChange={(event) => setPixKey(event.target.value)}
                disabled={busy}
              />
            </Field>
          ) : null}

          {method === "boleto" ? (
            <Field label="Arquivo PDF" required>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  if (!selected) return;

                  const message = validateFile(selected, "pdf");
                  if (message) {
                    setError(message);
                    return;
                  }
                  setError(null);
                  setFile(selected);
                }}
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="focus-ring flex w-full items-center gap-3 rounded-xl border border-dashed border-line bg-ink-50/60 px-4 py-4 text-left transition hover:bg-ink-100"
              >
                <FileUp className="size-5 shrink-0 text-ink-400" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    {file ? file.name : "Selecionar PDF"}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {file ? formatBytes(file.size) : "Apenas PDF, ate 25 MB"}
                  </span>
                </span>
              </button>
            </Field>
          ) : null}

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
