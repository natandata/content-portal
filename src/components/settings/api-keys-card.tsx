"use client";

import { useEffect, useState, useTransition } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CopyCode } from "@/components/clients/copy-code";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { CardHeader } from "@/components/ui/layout";
import { Modal } from "@/components/ui/modal";
import {
  createApiKeyAction,
  listApiKeysAction,
  revokeApiKeyAction,
  type ApiKeyStatus,
} from "@/server/actions/api-keys";
import { formatDateTime } from "@/lib/utils";

/**
 * Chave de API pro assistente MCP (Claude) -- conecta o servidor
 * `/api/mcp` como um conector na propria conta Claude do usuario e pede
 * acoes do Content Portal em linguagem natural (cadastrar cliente, cobranca
 * com QR do Mercado Pago, enviar documento). A chave so aparece em texto
 * puro uma vez, na hora que e gerada -- depois so o nome/data ficam
 * visiveis, igual senha.
 */
export function ApiKeysCard() {
  const [keys, setKeys] = useState<ApiKeyStatus[] | null>(null);
  const [name, setName] = useState("Claude");
  const [pending, startTransition] = useTransition();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  useEffect(() => {
    void listApiKeysAction().then((result) => {
      if (result.ok) setKeys(result.data);
    });
  }, []);

  function refresh() {
    void listApiKeysAction().then((result) => {
      if (result.ok) setKeys(result.data);
    });
  }

  return (
    <>
      <CardHeader
        title="Assistente (Claude)"
        description="Gere uma chave e conecte este endpoint como um conector MCP na sua conta Claude para cadastrar clientes, criar cobrancas e enviar documentos em linguagem natural."
      />

      <div className="mb-4 rounded-lg border border-line bg-ink-50/60 px-3 py-2.5 text-xs text-ink-600">
        Endereco do servidor:{" "}
        <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-800">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/mcp
        </code>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Nome da chave" htmlFor="api-key-name">
          <Input
            id="api-key-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
            className="max-w-[200px]"
          />
        </Field>
        <Button
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await createApiKeyAction({ name });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setRevealedKey(result.data.key);
              refresh();
            })
          }
        >
          <KeyRound className="size-4" aria-hidden />
          Gerar chave
        </Button>
      </div>

      {keys === null ? (
        <p className="text-sm text-ink-500">Carregando...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-ink-500">Nenhuma chave gerada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">{key.name}</p>
                <p className="text-xs text-ink-500">
                  Criada em {formatDateTime(key.createdAt)}
                  {key.lastUsedAt ? ` · usada pela ultima vez em ${formatDateTime(key.lastUsedAt)}` : ""}
                </p>
              </div>
              <IconButton
                label="Revogar chave"
                className="size-8 text-ink-400 hover:text-red-600"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeApiKeyAction(key.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Chave revogada.");
                    refresh();
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={revealedKey !== null}
        onClose={() => setRevealedKey(null)}
        title="Chave gerada"
        size="sm"
        footer={<Button onClick={() => setRevealedKey(null)}>Ja copiei</Button>}
      >
        <p className="mb-3 text-sm text-ink-600">
          Copie agora -- por seguranca, essa chave nao aparece de novo. Cole no cadastro de conector MCP
          da sua conta Claude junto com o endereco do servidor acima.
        </p>
        {revealedKey ? <CopyCode code={revealedKey} className="w-full justify-between" /> : null}
      </Modal>
    </>
  );
}
