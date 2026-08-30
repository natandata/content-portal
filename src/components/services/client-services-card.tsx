"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Card, CardHeader } from "@/components/ui/layout";
import { Modal } from "@/components/ui/modal";
import { CURRENCIES, CURRENCY_LABEL, formatMoney } from "@/lib/domain";
import {
  createClientServiceAction,
  deleteClientServiceAction,
} from "@/server/actions/client-services";
import type { ClientServiceRow, CurrencyCode } from "@/types/database";

/**
 * "Projetos Ativos" do dashboard do cliente vem daqui: cada linha e um
 * servico combinado (Social Media, Pacote de 10 videos...) com o valor.
 */
export function ClientServicesCard({
  clientId,
  services,
}: {
  clientId: string;
  services: ClientServiceRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("BRL");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setAmount("");
    setCurrency("BRL");
    setError(null);
  }

  return (
    <Card>
      <CardHeader
        title="Servicos combinados"
        actions={
          <IconButton label="Adicionar servico" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
          </IconButton>
        }
      />

      {services.length === 0 ? (
        <p className="text-sm text-ink-500">Nenhum servico cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2.5">
          {services.map((service) => (
            <li key={service.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink-800">
                <Layers className="size-3.5 shrink-0 text-ink-400" aria-hidden />
                <span className="truncate">{service.title}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-ink-900 tabular-nums">
                  {formatMoney(service.amount, service.currency)}
                </span>
                <IconButton
                  label="Remover servico"
                  className="size-7 text-ink-400 hover:text-red-600"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteClientServiceAction(service.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Adicionar servico"
        description='Ex.: "Social Media" · R$ 1.500,00'
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              loading={pending}
              onClick={() => {
                setError(null);
                if (title.trim().length < 2) {
                  setError("Informe o nome do servico.");
                  return;
                }
                const amountNumber = Number(amount);
                if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
                  setError("Informe um valor maior que zero.");
                  return;
                }
                startTransition(async () => {
                  const result = await createClientServiceAction({
                    clientId,
                    title,
                    amount: amountNumber,
                    currency,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  toast.success("Servico adicionado.");
                  setOpen(false);
                  reset();
                  router.refresh();
                });
              }}
            >
              Adicionar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome do servico" htmlFor="service-title" required>
            <Input
              id="service-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={pending}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor" htmlFor="service-amount" required>
              <Input
                id="service-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={pending}
              />
            </Field>

            <Field label="Moeda" htmlFor="service-currency" required>
              <Select
                id="service-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
                disabled={pending}
              >
                {CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {CURRENCY_LABEL[option]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </Card>
  );
}
