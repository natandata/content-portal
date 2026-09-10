import "server-only";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Cliente REST cru da API do Focus NFe (emissao de NFS-e -- nota fiscal de
 * servico eletronica). Autenticacao HTTP Basic com o token como usuario e
 * senha em branco (padrao documentado do Focus NFe).
 *
 * ATENCAO: o formato exato do corpo de `criarNfse` (nomes de campo de
 * tomador/servico) NAO foi confirmado ao vivo contra a documentacao deles
 * nesta sessao (o fetch da doc.focusnfe.com.br nao devolveu o conteudo
 * tecnico completo -- pagina renderizada via JS). Os campos abaixo seguem o
 * formato publico mais estavel e amplamente usado da API deles, mas
 * PRECISAM ser conferidos contra uma conta sandbox real antes do primeiro
 * envio de producao --ernitir nota com campo errado pode gerar rejeicao da
 * prefeitura, nao so um erro de app.
 */

function baseUrl(sandbox: boolean): string {
  return sandbox ? "https://homologacao.focusnfe.com.br" : "https://api.focusnfe.com.br";
}

function authHeader(apiToken: string): string {
  return `Basic ${Buffer.from(`${apiToken}:`).toString("base64")}`;
}

export interface NfeServicePayload {
  ref: string; // nosso id (invoice.id) -- correlaciona a resposta assincrona
  discriminacao: string; // descricao do servico prestado
  valorServicos: number;
  tomador: {
    cpf?: string;
    cnpj?: string;
    razaoSocial: string;
    email?: string;
  };
}

export interface NfeStatusResult {
  status: "processando_autorizacao" | "autorizado" | "erro_autorizacao" | "cancelado" | string;
  numero: string | null;
  urlPdf: string | null;
  erro: string | null;
}

/**
 * Dispara a emissao -- assincrona do lado do Focus NFe: a resposta imediata
 * so confirma que entrou na fila (`processando_autorizacao`); o status real
 * chega via webhook OU precisa ser consultado depois com `getNfeStatus`.
 */
export async function createNfse(
  apiToken: string,
  sandbox: boolean,
  payload: NfeServicePayload,
): Promise<Result<NfeStatusResult>> {
  try {
    const response = await fetch(`${baseUrl(sandbox)}/v2/nfse?ref=${encodeURIComponent(payload.ref)}`, {
      method: "POST",
      headers: { Authorization: authHeader(apiToken), "Content-Type": "application/json" },
      body: JSON.stringify({
        data_emissao: new Date().toISOString().slice(0, 19),
        discriminacao: payload.discriminacao,
        valor_servicos: payload.valorServicos,
        cpf_tomador: payload.tomador.cpf?.replace(/\D/g, "") || undefined,
        cnpj_tomador: payload.tomador.cnpj?.replace(/\D/g, "") || undefined,
        razao_social_tomador: payload.tomador.razaoSocial,
        email_tomador: payload.tomador.email || undefined,
      }),
    });

    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.status !== 200 && response.status !== 201 && response.status !== 202) {
      const message = (json.mensagem as string) ?? (json.erros as string) ?? `Focus NFe respondeu ${response.status}.`;
      return { ok: false, error: typeof message === "string" ? message : JSON.stringify(message) };
    }

    return {
      ok: true,
      data: {
        status: (json.status as string) ?? "processando_autorizacao",
        numero: (json.numero as string) ?? null,
        urlPdf: (json.url as string) ?? null,
        erro: (json.status_sefaz as string) ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao falar com o Focus NFe." };
  }
}

/** Consulta o status de uma nota pelo `ref` (nosso invoice.id) -- usado pelo cron de reconciliamento. */
export async function getNfeStatus(apiToken: string, sandbox: boolean, ref: string): Promise<Result<NfeStatusResult>> {
  try {
    const response = await fetch(`${baseUrl(sandbox)}/v2/nfse/${encodeURIComponent(ref)}`, {
      headers: { Authorization: authHeader(apiToken) },
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, error: (json.mensagem as string) ?? `Focus NFe respondeu ${response.status}.` };
    }
    return {
      ok: true,
      data: {
        status: (json.status as string) ?? "processando_autorizacao",
        numero: (json.numero as string) ?? null,
        urlPdf: (json.url as string) ?? null,
        erro: (json.status_sefaz as string) ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao falar com o Focus NFe." };
  }
}
