// Incrémenter ce nom à chaque modification du shell ou des modules publics.
// Cela force l’activation du nouveau service worker et purge les modules
// précédemment mis en cache, notamment firebase-client.js.
const CACHE_PREFIX = "bleu-massawippi-cockpit-shell-";
const RELEASE = "20260718-b31";
const CACHE = "bleu-massawippi-cockpit-shell-v67";
const SHELL = [
  "./", "./index.html", `./firebase-config.js?v=${RELEASE}`, `./theme.js?v=${RELEASE}`, `./motion.js?v=${RELEASE}`,
  `./cockpit-ui.js?v=${RELEASE}`, `./firebase-client.js?v=${RELEASE}`, `./section-navigation.js?v=${RELEASE}`, `./publication-editor-schema.mjs?v=${RELEASE}`, `./editor-studio.js?v=${RELEASE}`, `./control-hints.js?v=${RELEASE}`, `./event-context-data.js?v=${RELEASE}`, `./action-items-ui.js?v=${RELEASE}`, `./client-health-ui.js?v=${RELEASE}`, `./admin-lazy-data.js?v=${RELEASE}`, `./admin-activity-summary.js?v=${RELEASE}`, `./media-choice-ui.js?v=${RELEASE}`, `./task-progress-ui.js?v=${RELEASE}`, `./view-mode.js?v=${RELEASE}`, `./clarity.css?v=${RELEASE}`, "./view-mode.css",
  "./manifest.webmanifest", "./icon.svg", "./icons.svg", "./assets/strategy/reperes-cockpit-2x2.webp"
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
