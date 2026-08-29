"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { changePasswordAction } from "@/server/actions/account";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="max-w-sm space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setBusy(true);

        void changePasswordAction({ currentPassword, newPassword, confirmPassword })
          .then((result) => {
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast.success("Senha alterada com sucesso.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
          })
          .finally(() => setBusy(false));
      }}
    >
      <Field label="Senha atual" htmlFor="currentPassword" required>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          disabled={busy}
        />
      </Field>

      <Field label="Nova senha" htmlFor="newPassword" hint="Minimo de 8 caracteres." required>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={busy}
        />
      </Field>

      <Field label="Confirmar nova senha" htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={busy}
        />
      </Field>

      <FormError>{error}</FormError>

      <Button type="submit" loading={busy}>
        Alterar senha
      </Button>
    </form>
  );
}
