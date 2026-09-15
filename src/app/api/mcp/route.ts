import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { appBaseUrl } from "@/lib/env";
import { addClientServiceTool } from "@/server/mcp/client-services";
import { createClientTool, findClientTool } from "@/server/mcp/clients";
import { resolveMcpActor, type McpActor } from "@/server/mcp/auth";
import { sendDocumentForSignatureTool } from "@/server/mcp/documents";
import { attachDocumentToChargeTool, createMercadoPagoChargeTool } from "@/server/mcp/invoices";
import type { ActionResult } from "@/server/result";

/**
 * Servidor MCP do Content Portal -- o "assistente por voz/chat" pedido pelo
 * usuario: conecta como um conector MCP na propria conta Claude (claude.ai
 * ou Claude Code) e permite cadastrar cliente, adicionar servico, criar
 * cobranca Pix (Mercado Pago) e enviar documento em linguagem natural, sem
 * abrir o app. Autenticacao por chave de API (`Authorization: Bearer
 * <chave>`, ver `src/server/mcp/auth.ts` e `src/server/actions/api-keys.ts`)
 * -- nao ha cookie de sessao aqui, o MCP roda fora do navegador.
 *
 * Modo stateless (sem `sessionIdGenerator`): cada requisicao HTTP monta um
 * `McpServer` novo, registra as ferramentas fechadas sobre o `actor`
 * resolvido daquela chamada, e processa -- compativel com o modelo
 * serverless da Vercel (sem conexao persistente garantida entre chamadas).
 */

export const runtime = "nodejs";

function toolResult<T>(result: ActionResult<T>) {
  if (!result.ok) {
    return { content: [{ type: "text" as const, text: `Erro: ${result.error}` }], isError: true };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }] };
}

function buildServer(actor: McpActor): McpServer {
  const server = new McpServer({ name: "content-portal", version: "1.0.0" });

  server.registerTool(
    "find_client",
    {
      title: "Buscar cliente",
      description:
        "Busca clientes pelo nome ou nome da empresa (busca parcial). Use antes das outras ferramentas para descobrir o clientId certo.",
      inputSchema: {
        query: z.string().min(1).describe("Nome ou empresa do cliente, mesmo que parcial"),
      },
    },
    async ({ query }) => toolResult(await findClientTool(actor, query)),
  );

  server.registerTool(
    "create_client",
    {
      title: "Cadastrar cliente",
      description: "Cadastra um novo cliente no Content Portal e devolve o id e o codigo de acesso dele.",
      inputSchema: {
        name: z.string().min(2).describe("Nome do contato responsavel pelo cliente"),
        companyName: z.string().min(2).describe("Nome da empresa/marca do cliente"),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        tag: z.string().optional().describe("Segmento/nicho, rotulo livre exibido no card do cliente"),
        professionalId: z
          .string()
          .uuid()
          .optional()
          .describe("So faz efeito se voce (dono da chave) for admin -- atribui o cliente a esse profissional"),
      },
    },
    async (input) => toolResult(await createClientTool(actor, input)),
  );

  server.registerTool(
    "add_client_service",
    {
      title: "Adicionar servico contratado",
      description: "Adiciona um servico contratado a um cliente ja cadastrado, com valor e data de inicio.",
      inputSchema: {
        clientId: z.string().uuid().describe("id do cliente -- use find_client se nao souber"),
        title: z.string().min(2).describe("Nome do servico, ex.: Gestao de Instagram"),
        amount: z.number().positive().optional().describe("Valor combinado -- obrigatorio a nao ser que isPartnership seja true"),
        currency: z.enum(["BRL", "USD", "EUR", "GBP"]).optional().describe("Padrao BRL"),
        isPartnership: z.boolean().optional().describe("true = permuta/cortesia, sem cobranca em dinheiro"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Data combinada de inicio deste servico, formato AAAA-MM-DD"),
      },
    },
    async (input) => toolResult(await addClientServiceTool(actor, input)),
  );

  server.registerTool(
    "create_mercadopago_charge",
    {
      title: "Criar cobranca Pix (Mercado Pago)",
      description:
        "Cria uma cobranca com QR code Pix automatico via Mercado Pago para um cliente. Exige que o profissional responsavel pelo cliente ja tenha conectado a propria conta Mercado Pago (Configuracoes > Publicacoes) -- se nao tiver, a ferramenta devolve erro explicando isso.",
      inputSchema: {
        clientId: z.string().uuid().describe("id do cliente -- use find_client se nao souber"),
        title: z.string().min(2).describe("Titulo/descricao da cobranca"),
        amount: z.number().positive().describe("Valor em reais (BRL -- unico suportado por este metodo)"),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data de vencimento, formato AAAA-MM-DD"),
        payerName: z.string().min(2).describe("Nome completo do pagador (exigido pelo Mercado Pago)"),
        payerCpf: z.string().min(11).describe("CPF do pagador, com ou sem pontuacao (exigido pelo Mercado Pago)"),
      },
    },
    async (input) => toolResult(await createMercadoPagoChargeTool(actor, input)),
  );

  server.registerTool(
    "attach_document_to_charge",
    {
      title: "Anexar documento a uma cobranca",
      description:
        "Anexa um arquivo (PDF, imagem etc., em base64) a uma cobranca ja criada -- o cliente ve o anexo junto do QR code/pagamento na propria tela de cobrancas.",
      inputSchema: {
        invoiceId: z.string().uuid().describe("id da cobranca (devolvido por create_mercadopago_charge)"),
        fileBase64: z.string().min(1).describe("Conteudo do arquivo codificado em base64"),
        fileName: z.string().min(1),
        mimeType: z.string().optional().describe("Padrao application/pdf"),
      },
    },
    async (input) => toolResult(await attachDocumentToChargeTool(actor, input)),
  );

  server.registerTool(
    "send_document_for_signature",
    {
      title: "Enviar documento para assinatura",
      description:
        "Cria um documento e ja envia para assinatura eletronica via Autentique -- independente de qualquer cobranca. O arquivo precisa ser um PDF.",
      inputSchema: {
        clientId: z.string().uuid().describe("id do cliente -- use find_client se nao souber"),
        title: z.string().min(2).describe("Titulo do documento"),
        fileBase64: z.string().min(1).describe("Conteudo do PDF codificado em base64"),
        fileName: z.string().min(1),
        signerName: z.string().min(2).describe("Nome de quem vai assinar"),
        signerEmail: z.string().email().describe("E-mail de quem vai assinar"),
      },
    },
    async (input) => toolResult(await sendDocumentForSignatureTool(actor, input)),
  );

  return server;
}

async function handle(request: Request): Promise<Response> {
  const actor = await resolveMcpActor(request.headers.get("authorization"));
  if (!actor) {
    // WWW-Authenticate aponta pro metadado de recurso protegido (RFC 9728) --
    // e' assim que o conector do claude.ai/app descobre o servidor de
    // autorizacao (`.well-known/oauth-authorization-server`, ver
    // `src/app/api/mcp/metadata/*`) e dispara o fluxo de OAuth sozinho.
    return new Response(JSON.stringify({ error: "Chave de API invalida, ausente ou revogada." }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer resource_metadata="${appBaseUrl()}/.well-known/oauth-protected-resource"`,
      },
    });
  }

  const server = buildServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as DELETE, handle as GET, handle as POST };
