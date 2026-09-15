import "server-only";

import { getActor } from "@/lib/auth";
import { createAuthorizationCode, findOAuthClient } from "@/server/mcp/oauth";

/**
 * Tela de autorizacao do fluxo OAuth (Authorization Code + PKCE) do conector
 * MCP. GET mostra login (se nao houver sessao) ou o consentimento (se
 * houver); POST confirma e redireciona de volta pro cliente (claude.ai/app)
 * com o `code`. Reaproveita a sessao de cookie que o Content Portal ja usa
 * (`getActor()`) -- nao existe login separado so pro assistente.
 */

function page(title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f7f7f8; color: #18181b; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; padding: 24px; }
  .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; max-width: 380px; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  h1 { font-size: 18px; margin: 0 0 6px; }
  p { font-size: 14px; color: #52525b; line-height: 1.5; margin: 0 0 20px; }
  label { display: block; font-size: 13px; font-weight: 500; margin: 14px 0 6px; }
  input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #d4d4d8; border-radius: 8px; font-size: 14px; }
  button { width: 100%; margin-top: 20px; padding: 11px; border: none; border-radius: 8px; background: #18181b; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
  button.secondary { background: #f4f4f5; color: #18181b; margin-top: 8px; }
  .error { background: #fef2f2; color: #991b1b; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 16px; }
  .brand { font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">Content Portal</div>
    ${body}
  </div>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function hiddenFields(params: URLSearchParams, keys: string[]): string {
  return keys
    .map((key) => {
      const value = params.get(key);
      return value ? `<input type="hidden" name="${key}" value="${escapeHtml(value)}" />` : "";
    })
    .join("\n");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const OAUTH_PARAM_KEYS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "state",
  "code_challenge",
  "code_challenge_method",
  "scope",
];

async function validateRequest(params: URLSearchParams) {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const responseType = params.get("response_type");

  if (!clientId || !redirectUri) {
    return { ok: false as const, response: page("Erro", `<h1>Pedido invalido</h1><p>Faltam parametros obrigatorios (client_id, redirect_uri).</p>`) };
  }

  const client = await findOAuthClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    // redirect_uri nao confere -- nao redireciona (spec), mostra erro direto.
    return { ok: false as const, response: page("Erro", `<h1>Conector nao reconhecido</h1><p>Este conector nao esta registrado ou o endereco de retorno nao confere.</p>`) };
  }

  if (responseType !== "code" || codeChallengeMethod !== "S256" || !codeChallenge) {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "invalid_request");
    const state = params.get("state");
    if (state) url.searchParams.set("state", state);
    return { ok: false as const, response: Response.redirect(url.toString(), 302) };
  }

  return { ok: true as const, client, redirectUri, codeChallenge };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const validated = await validateRequest(url.searchParams);
  if (!validated.ok) return validated.response;

  const actor = await getActor();
  const hidden = hiddenFields(url.searchParams, OAUTH_PARAM_KEYS);

  if (!actor || actor.role === "client") {
    return page(
      "Entrar",
      `<h1>Entrar</h1>
      <p>Entre com sua conta da equipe para autorizar o assistente Claude a acessar o Content Portal.</p>
      <div id="error" class="error" style="display:none"></div>
      <form id="login-form">
        <label for="identifier">Usuario ou email</label>
        <input id="identifier" name="identifier" autocomplete="username" required />
        <label for="password">Senha</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Entrar</button>
      </form>
      <script>
        document.getElementById('login-form').addEventListener('submit', async function (event) {
          event.preventDefault();
          var errorBox = document.getElementById('error');
          errorBox.style.display = 'none';
          var identifier = document.getElementById('identifier').value;
          var password = document.getElementById('password').value;
          try {
            var response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identifier: identifier, password: password }),
            });
            if (!response.ok) {
              var payload = await response.json().catch(function () { return {}; });
              errorBox.textContent = payload.error || 'Nao foi possivel entrar.';
              errorBox.style.display = 'block';
              return;
            }
            window.location.reload();
          } catch (e) {
            errorBox.textContent = 'Falha de conexao. Tente novamente.';
            errorBox.style.display = 'block';
          }
        });
      </script>`,
    );
  }

  return page(
    "Autorizar",
    `<h1>Autorizar o assistente Claude</h1>
    <p>Conectado como <strong>${escapeHtml(actor.displayName)}</strong>. O Claude podera cadastrar clientes, adicionar servicos, criar cobrancas e enviar documentos em seu nome.</p>
    <form method="POST">
      ${hidden}
      <button type="submit" name="decision" value="allow">Autorizar</button>
      <button type="submit" name="decision" value="deny" class="secondary">Cancelar</button>
    </form>`,
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const key of OAUTH_PARAM_KEYS) {
    const value = form.get(key);
    if (typeof value === "string") params.set(key, value);
  }

  const validated = await validateRequest(params);
  if (!validated.ok) return validated.response;

  const actor = await getActor();
  if (!actor || actor.role === "client") {
    return page("Sessao expirada", `<h1>Sessao expirada</h1><p>Entre novamente e repita a autorizacao.</p>`);
  }

  const decision = form.get("decision");
  const redirectUrl = new URL(validated.redirectUri);
  const state = params.get("state");
  if (state) redirectUrl.searchParams.set("state", state);

  if (decision !== "allow") {
    redirectUrl.searchParams.set("error", "access_denied");
    return Response.redirect(redirectUrl.toString(), 302);
  }

  const created = await createAuthorizationCode({
    clientId: validated.client.client_id,
    professionalId: actor.authUser.id,
    redirectUri: validated.redirectUri,
    codeChallenge: validated.codeChallenge,
  });

  if (!created.ok) {
    redirectUrl.searchParams.set("error", "server_error");
    return Response.redirect(redirectUrl.toString(), 302);
  }

  redirectUrl.searchParams.set("code", created.data);
  return Response.redirect(redirectUrl.toString(), 302);
}
