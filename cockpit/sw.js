// Incrémenter ce nom à chaque modification du shell ou des modules publics.
// Cela force l’activation du nouveau service worker et purge les modules
// précédemment mis en cache, notamment firebase-client.js.
const CACHE_PREFIX = "bleu-massawippi-cockpit-shell-";
const RELEASE = "20260824-b66";
const CACHE = "bleu-massawippi-cockpit-shell-v98";
const SHELL = [
  "./", "./index.html", `./firebase-config.js?v=${RELEASE}`, `./theme.js?v=${RELEASE}`, `./motion.js?v=${RELEASE}`,
  `./cockpit-ui.js?v=${RELEASE}`, `./content-layout.js?v=${RELEASE}`, `./calendar-export-tools.js?v=${RELEASE}`, `./internal-project-order.js?v=${RELEASE}`, `./firebase-client.js?v=${RELEASE}`, `./project-calendar-model.mjs?v=${RELEASE}`, `./project-calendar.js?v=${RELEASE}`, `./section-navigation.js?v=${RELEASE}`, `./publication-editor-schema.mjs?v=${RELEASE}`, `./editor-studio.js?v=${RELEASE}`, `./control-hints.js?v=${RELEASE}`, `./event-context-data.js?v=${RELEASE}`, `./action-items-ui.js?v=${RELEASE}`, `./notification-recipient.js?v=${RELEASE}`, `./client-health-ui.js?v=${RELEASE}`, `./admin-lazy-data.js?v=${RELEASE}`, `./admin-activity-summary.js?v=${RELEASE}`, `./media-choice-ui.js?v=${RELEASE}`, `./task-progress-ui.js?v=${RELEASE}`, `./completed-task-history.js?v=${RELEASE}`, `./monthly-snapshot-state.js?v=${RELEASE}`, `./view-mode.js?v=${RELEASE}`, `./clarity.css?v=${RELEASE}`, `./project-calendar.css?v=${RELEASE}`, `./view-mode.css?v=${RELEASE}`,
  "./manifest.webmanifest", "./icon.svg", "./icons.svg", "./assets/brand/logo-bleu-massawippi-2024.png", "./assets/brand/cockpit-bleu-massawippi-lockup.svg", "./assets/brand/cockpit-bleu-massawippi-icon-192.png", "./assets/brand/cockpit-bleu-massawippi-icon-512.png", "./assets/strategy/reperes-cockpit-2x2.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type:"window", includeUncontrolled:true }))
    .then((clients) => clients.forEach((client) => client.postMessage({ type:"cockpit-update-ready", release:RELEASE }))));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "cockpit-release-request") return;
  const message = { type:"cockpit-release-info", release:RELEASE };
  if (event.source?.postMessage) event.source.postMessage(message);
  else event.ports?.[0]?.postMessage?.(message);
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;
  const shellRequest = sameOrigin && (event.request.mode === "navigate" || ["script", "style", "worker"].includes(event.request.destination));
  event.respondWith(fetch(event.request, shellRequest ? { cache:"no-store" } : undefined).then((response) => {
    if (response.ok && sameOrigin) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (event.request.mode === "navigate") return caches.match("./index.html");
    return new Response("Ressource indisponible hors connexion.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./?notification=decisions", self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === new URL(targetUrl).origin);
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: "cockpit-open-attention" });
      return;
    }
    await self.clients.openWindow(targetUrl);
  }));
});
