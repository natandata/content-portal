"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";

/**
 * Solicitacao de acesso de profissional. A conta e criada travada e so passa a
 * funcionar depois que o administrador aprova.
 */
export function AccessRequestForm({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }
    if (password.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, note }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Nao foi possivel enviar a solicitacao.");
        return;
      }

      setSent(payload.message ?? "Solicitacao registrada.");
    } catch {
      setError("Falha de conexao. Verifique sua internet e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <h2 className="text-sm font-semibold text-ink-900">Solicitacao enviada</h2>
        <p className="mt-2 text-sm text-ink-500">{sent}</p>
        <Button variant="outline" className="mt-5" onClick={onBack}>
          Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <button
        type="button"
        onClick={onBack}
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-sm text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar
      </button>

      <h2 className="text-sm font-semibold text-ink-900">Solicitar acesso</h2>
      <p className="mt-1 mb-4 text-sm text-ink-500">
        Sua conta fica pendente ate o administrador aprovar.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome" htmlFor="request-name" required>
          <Input
            id="request-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Como voce quer ser identificado"
            autoComplete="name"
            disabled={busy}
          />
        </Field>

        <Field label="Email" htmlFor="request-email" required>
          <Input
            id="request-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            autoComplete="email"
            disabled={busy}
            required
          />
        </Field>

        <Field
          label="Senha"
          htmlFor="request-password"
          hint="Minimo de 8 caracteres. Voce usara essa senha depois da aprovacao."
          required
        >
          <Input
            id="request-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            disabled={busy}
          />
        </Field>

        <Field label="Mensagem" htmlFor="request-note" hint="Opcional.">
          <Textarea
            id="request-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Conte quem indicou voce ou com o que vai trabalhar."
            disabled={busy}
          />
        </Field>

        <FormError>{error}</FormError>

        <Button type="submit" size="lg" fullWidth loading={busy}>
          Enviar solicitacao
        </Button>
      </form>
    </div>
  );
}
