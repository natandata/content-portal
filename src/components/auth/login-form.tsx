"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { AccessRequestForm } from "@/components/auth/access-request-form";
import { LoadingCurtain } from "@/components/auth/loading-curtain";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { ACCESS_CODE_PATTERN } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

type Tab = "staff" | "client";
type Mode = "login" | "request" | "admin";

interface Props {
  locale: Locale;
}

// So `locale` cruza a fronteira Server -> Client Component. O dicionario
// inteiro tem campos com funcao (textos com variavel) e o RSC nao serializa
// funcao como prop — cada Client Component busca o proprio dicionario aqui.
function LoginFormInner({ locale }: Props) {
  const dict = getDictionary(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("staff");
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);

  const nextPath = searchParams.get("next");

  async function submit(endpoint: string, body: Record<string, string>) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        redirect?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? dict.login.connectionError);
        return;
      }

      // So respeitamos ?next= se ele pertencer a area da role autenticada.
      const fallback = payload.redirect ?? "/";
      const area = fallback.split("/")[1];
      const target =
        nextPath && area && nextPath.startsWith(`/${area}/`) ? nextPath : fallback;

      // A cortina cobre a tela por 5s; aproveitamos para carregar o destino.
      router.prefetch(target);
      setDestination(target);
    } catch {
      setError(dict.login.connectionError);
      setLoading(false);
    }
  }

  function onStaffSubmit(event: FormEvent) {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError(dict.login.fillStaff);
      return;
    }
    void submit("/api/auth/login", { identifier: identifier.trim(), password });
  }

  function onClientSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!ACCESS_CODE_PATTERN.test(normalized)) {
      setError(dict.login.invalidCode);
      return;
    }
    void submit("/api/auth/client", { code: normalized });
  }

  // O admin nao tem email visivel: o servidor resolve "Admin" via ADMIN_EMAIL.
  function onAdminSubmit(event: FormEvent) {
    event.preventDefault();
    if (!adminPassword) {
      setError(dict.login.fillPassword);
      return;
    }
    void submit("/api/auth/login", { identifier: "Admin", password: adminPassword });
  }

  if (destination) {
    return (
      <LoadingCurtain
        message={dict.curtain.message}
        onDone={() => {
          router.replace(destination);
          router.refresh();
        }}
      />
    );
  }

  function voltar() {
    setMode("login");
    setError(null);
  }

  if (mode === "request") {
    return <AccessRequestForm locale={locale} onBack={voltar} />;
  }

  if (mode === "admin") {
    return (
      <div className="card p-5">
        <button
          type="button"
          onClick={voltar}
          className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-sm text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {dict.login.back}
        </button>

        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <ShieldCheck className="size-4 text-ink-400" aria-hidden />
          {dict.login.adminAccess}
        </h2>
        <p className="mt-1 mb-4 text-sm text-ink-500">{dict.login.adminOnlyUser}</p>

        <form onSubmit={onAdminSubmit} className="space-y-4">
          <Field label={dict.login.password} htmlFor="admin-password" required>
            <Input
              id="admin-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              disabled={loading}
            />
          </Field>

          <FormError>{error}</FormError>

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {dict.login.adminEnter}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line bg-ink-50 p-1.5">
          {(
            [
              ["staff", dict.login.tabStaff],
              ["client", dict.login.tabClient],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                setError(null);
              }}
              className={cn(
                "focus-ring rounded-lg py-2 text-sm font-medium transition",
                tab === value
                  ? "bg-surface text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "staff" ? (
            <form onSubmit={onStaffSubmit} className="space-y-4">
              <Field label={dict.login.identifier} htmlFor="identifier">
                <Input
                  id="identifier"
                  name="identifier"
                  autoComplete="username"
                  placeholder={dict.login.identifierPlaceholder}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  disabled={loading}
                />
              </Field>

              <Field label={dict.login.password} htmlFor="password">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                />
              </Field>

              <FormError>{error}</FormError>

              <Button type="submit" size="lg" fullWidth loading={loading}>
                {dict.login.enter}
              </Button>
            </form>
          ) : (
            <form onSubmit={onClientSubmit} className="space-y-4">
              <Field label={dict.login.accessCode} htmlFor="code" hint={dict.login.accessCodeHint}>
                <Input
                  id="code"
                  name="code"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  maxLength={7}
                  placeholder="ABC1234"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 7))}
                  disabled={loading}
                  className="text-center text-lg font-semibold tracking-[0.4em] uppercase"
                />
              </Field>

              <FormError>{error}</FormError>

              <Button type="submit" size="lg" fullWidth loading={loading}>
                {dict.login.enter}
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* O admin nao e profissional nem cliente: precisa de porta propria. */}
        <Button
          variant="outline"
          size="sm"
          fullWidth
          className="gap-2"
          onClick={() => {
            setMode("admin");
            setError(null);
          }}
        >
          <ShieldCheck className="size-4" aria-hidden />
          {dict.login.adminAccess}
        </Button>

        {tab === "staff" ? (
          <p className="text-center text-sm text-ink-400">
            {dict.login.noAccess}{" "}
            <button
              type="button"
              onClick={() => {
                setMode("request");
                setError(null);
              }}
              className="focus-ring rounded font-medium text-ink-600 underline underline-offset-2 transition hover:text-ink-900"
            >
              {dict.login.request}
            </button>
          </p>
        ) : null}
      </div>
    </>
  );
}

export function LoginForm({ locale }: Props) {
  return (
    <Suspense fallback={<div className="card h-[320px] animate-pulse" />}>
      <LoginFormInner locale={locale} />
    </Suspense>
  );
}
