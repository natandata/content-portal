"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { createClientAction, updateClientAction } from "@/server/actions/clients";
import type { ClientRow, UserRole } from "@/types/database";

export interface ProfessionalOption {
  id: string;
  name: string;
}

interface Props {
  role: UserRole;
  professionals: ProfessionalOption[];
  client?: ClientRow;
  label?: string;
  /** Pre-seleciona o profissional ao criar — usado quando o admin cria a partir da tela de um profissional. */
  defaultProfessionalId?: string;
}

export function ClientFormModal({ role, professionals, client, label, defaultProfessionalId }: Props) {
  const router = useRouter();
  const isEdit = Boolean(client);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(client?.name ?? "");
  const [companyName, setCompanyName] = useState(client?.company_name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [professionalId, setProfessionalId] = useState(
    client?.professional_id ?? defaultProfessionalId ?? "",
  );
  const [status, setStatus] = useState<"active" | "inactive">(client?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    if (isEdit) return;
    setName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setProfessionalId(defaultProfessionalId ?? "");
  }

  async function submit() {
    setError(null);
    setBusy(true);

    try {
      const payload = { name, companyName, email, phone, professionalId };

      const result = isEdit
        ? await updateClientAction({ ...payload, id: client!.id, status })
        : await createClientAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(
        isEdit
          ? "Cliente atualizado."
          : `Cliente criado. Codigo de acesso: ${result.data.access_code}`,
      );
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={isEdit ? "outline" : "primary"}
        size={isEdit ? "sm" : "md"}
        onClick={() => setOpen(true)}
      >
        {isEdit ? null : <Plus className="size-4" aria-hidden />}
        {label ?? (isEdit ? "Editar" : "Novo cliente")}
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={isEdit ? "Editar cliente" : "Novo cliente"}
        description={
          isEdit ? undefined : "O codigo de acesso e gerado automaticamente ao salvar."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              {isEdit ? "Salvar" : "Criar cliente"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do contato" htmlFor="client-name" required>
            <Input
              id="client-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Joao Silva"
              disabled={busy}
            />
          </Field>

          <Field label="Empresa" htmlFor="client-company" required>
            <Input
              id="client-company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Empresa XYZ"
              disabled={busy}
            />
          </Field>

          <Field label="Email" htmlFor="client-email">
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="contato@empresa.com"
              disabled={busy}
            />
          </Field>

          <Field label="Telefone" htmlFor="client-phone">
            <Input
              id="client-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(11) 90000-0000"
              disabled={busy}
            />
          </Field>

          {role === "admin" ? (
            <Field label="Profissional responsavel" htmlFor="client-professional">
              <Select
                id="client-professional"
                value={professionalId}
                onChange={(event) => setProfessionalId(event.target.value)}
                disabled={busy}
              >
                <option value="">Sem responsavel</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {isEdit ? (
            <Field label="Status" htmlFor="client-status">
              <Select
                id="client-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as "active" | "inactive")}
                disabled={busy}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </Select>
            </Field>
          ) : null}
        </div>

        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
