/*
 * Service worker do Content.
 *
 * Deliberadamente conservador: esta e uma aplicacao autenticada, entao nada de
 * HTML de pagina ou resposta de API entra em cache — servir uma pagina de um
 * usuario para outro seria pior do que ficar sem offline. O cache guarda apenas
 * assets imutaveis e a pagina de fallback.
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const OFFLINE_URL = "/offline";

const SHELL = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Assets versionados pelo build: o conteudo nunca muda para uma mesma URL. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Rotas de autenticacao e de dados nunca passam pelo cache.
  if (url.pathname.startsWith("/api/")) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Navegacao: sempre rede. Sem rede, cai na pagina de offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) =>
            cached ??
            new Response("Sem conexao.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        ),
      ),
    );
  }
});

/*
 * Notificacoes push.
 *
 * O payload chega em JSON, montado pelo servidor em src/lib/push.ts. O clique
 * foca uma aba ja aberta na mesma origem em vez de sempre abrir outra —
 * evita empilhar abas do portal quando a pessoa ja esta com uma aberta.
 */
self.addEventListener("push", (event) => {
  let payload = { title: "Content", body: "Voce tem uma atualizacao." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Payload nao veio em JSON — segue com o texto padrao.
  }

  const url = payload.url || "/";

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url;
  if (!targetUrl) return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsList) => {
        const target = new URL(targetUrl, self.location.origin).href;

        for (const client of clientsList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }

        return self.clients.openWindow(target);
      }),
  );
});

self.addEventListener("pushsubscriptionchange", () => {
  // O navegador as vezes renova a inscricao sozinho (endpoint mudou). Sem um
  // canal para reinscrever em segundo plano, a proxima abertura do app resolve
  // isso — a UI de notificacoes detecta a divergencia e reinscreve.
});
