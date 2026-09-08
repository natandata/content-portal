import "server-only";

import { autentiqueConfig } from "@/lib/env";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const GRAPHQL_URL = "https://api.autentique.com.br/v2/graphql";

/**
 * Cliente da API real do Autentique (GraphQL) -- confirmado contra a
 * documentacao publica (docs.autentique.com.br) em 2026-09-08, nao contra o
 * conector MCP usado so pra pesquisa nesta sessao (o MCP sugeria um fluxo de
 * upload em duas etapas que NAO existe na API real -- a mutation real
 * `createDocument` recebe o arquivo na MESMA chamada, via multipart/form-data
 * seguindo a GraphQL multipart request spec).
 */

async function jsonRequest<T>(apiKey: string, query: string, variables: Record<string, unknown>): Promise<Result<T>> {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await response.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
    if (!json) return { ok: false, error: `Autentique respondeu ${response.status} sem corpo valido.` };
    // Erro de GraphQL pode vir junto com HTTP 200 -- checar `errors` sempre,
    // nao so o status HTTP.
    if (json.errors && json.errors.length > 0) {
      return { ok: false, error: json.errors.map((e) => e.message).join("; ") };
    }
    if (!response.ok || !json.data) {
      return { ok: false, error: `Autentique respondeu ${response.status}.` };
    }
    return { ok: true, data: json.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao falar com o Autentique." };
  }
}

/**
 * Cria o documento de assinatura -- mutation `createDocument(document:
 * DocumentInput!, signers: [SignerInput!]!, file: Upload!)`. O arquivo vai
 * direto nesta chamada (multipart), sem etapa de upload separada.
 */
export async function createSignatureDocument(params: {
  name: string;
  fileBytes: Buffer;
  fileName: string;
  signer: { name: string; email: string };
}): Promise<Result<{ autentiqueDocumentId: string }>> {
  const config = autentiqueConfig();
  if (!config) return { ok: false, error: "Autentique nao configurado nesta instalacao." };

  const query = `
    mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id
      }
    }
  `;
  const variables = {
    document: { name: params.name },
    signers: [{ name: params.signer.name, email: params.signer.email, action: "SIGN" }],
    file: null,
  };

  const form = new FormData();
  form.append("operations", JSON.stringify({ query, variables }));
  form.append("map", JSON.stringify({ "0": ["variables.file"] }));
  form.append("0", new Blob([new Uint8Array(params.fileBytes)], { type: "application/pdf" }), params.fileName);

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    });
    const json = (await response.json().catch(() => null)) as
      | { data?: { createDocument?: { id?: string } }; errors?: { message: string }[] }
      | null;
    if (!json) return { ok: false, error: `Autentique respondeu ${response.status} sem corpo valido.` };
    if (json.errors && json.errors.length > 0) {
      return { ok: false, error: json.errors.map((e) => e.message).join("; ") };
    }
    const id = json.data?.createDocument?.id;
    if (!response.ok || !id) return { ok: false, error: "Autentique nao devolveu o id do documento criado." };
    return { ok: true, data: { autentiqueDocumentId: id } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao enviar o documento pro Autentique.",
    };
  }
}

/**
 * Consulta o documento -- usado pelo reconciliamento (rede de seguranca do
 * webhook global). `files.signed` so vem preenchido quando o documento foi
 * assinado por todos -- e' o sinal de "terminou" que usamos, sem precisar
 * inspecionar cada assinatura individual.
 */
export async function getDocumentStatus(
  autentiqueDocumentId: string,
): Promise<Result<{ signedFileUrl: string | null }>> {
  const config = autentiqueConfig();
  if (!config) return { ok: false, error: "Autentique nao configurado nesta instalacao." };

  const query = `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id
        files { signed }
      }
    }
  `;
  const result = await jsonRequest<{ document?: { files?: { signed?: string | null } } }>(
    config.apiKey,
    query,
    { id: autentiqueDocumentId },
  );
  if (!result.ok) return result;
  return { ok: true, data: { signedFileUrl: result.data.document?.files?.signed ?? null } };
}

/** Baixa os bytes do PDF assinado a partir da URL devolvida por `getDocumentStatus`. */
export async function downloadSignedPdf(signedFileUrl: string): Promise<Result<Buffer>> {
  try {
    const response = await fetch(signedFileUrl);
    if (!response.ok) return { ok: false, error: `Falha ao baixar o PDF assinado (${response.status}).` };
    const arrayBuffer = await response.arrayBuffer();
    return { ok: true, data: Buffer.from(arrayBuffer) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao baixar o PDF assinado." };
  }
}
