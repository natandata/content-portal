"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  createProfessionalAction,
  updateProfessionalAction,
} from "@/server/actions/professionals";
import type { UserRow } from "@/types/database";

export function ProfessionalFormModal({ professional }: { professional?: UserRow }) {
  const router = useRouter();
  const isEdit = Boolean(professional);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(professional?.name ?? "");
  const [email, setEmail] = useState(professional?.email ?? "");
  const [password, setPassword] = useState("");
  // O modal so edita profissionais ja resolvidos; 'pending' é tratado na
  // secao de solicitacoes, com aprovar/recusar.
  const [status, setStatus] = useState<"active" | "inactive">(
    professional?.status === "inactive" ? "inactive" : "active",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);

    try {
      const result = isEdit
        ? await updateProfessionalAction({
            id: professional!.id,
            name,
            status,
            password,
          })
        : await createProfessionalAction({ name, email, password });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(isEdit ? "Profissional atualizado." : "Profissional criado.");
      setOpen(false);
      setPassword("");
      if (!isEdit) {
        setName("");
        setEmail("");
      }
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
        {isEdit ? "Editar" : "Novo profissional"}
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={isEdit ? "Editar profissional" : "Novo profissional"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome" htmlFor="professional-name" required>
            <Input
              id="professional-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
          </Field>

          <Field label="Email" htmlFor="professional-email" required>
            <Input
              id="professional-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy || isEdit}
            />
          </Field>

          <Field
            label={isEdit ? "Nova senha" : "Senha"}
            htmlFor="professional-password"
            hint={isEdit ? "Deixe em branco para manter a senha atual." : "Minimo de 8 caracteres."}
            required={!isEdit}
          >
            <Input
              id="professional-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
          </Field>

          {isEdit ? (
            <Field label="Status" htmlFor="professional-status">
              <Select
                id="professional-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as "active" | "inactive")}
                disabled={busy}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </Select>
            </Field>
          ) : null}

          <FormError>{error}</FormError>
        </div>
      </Modal>
    </>
  );
}
