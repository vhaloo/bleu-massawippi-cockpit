import {
  getClientState,
  getClientDiagnostics,
  subscribeClientDiagnostics,
  setPersistentCachePreference,
  requestSafeMode,
  forgetThisDevice
} from "./firebase-client.js?v=20260722-b39";

let unsubscribeDiagnostics = null;

function ensureStyles() {
  if (document.querySelector("#cockpit-health-styles")) return;
  const style = document.createElement("style");
  style.id = "cockpit-health-styles";
  style.textContent = `
    #cockpit-health-launch{position:fixed;right:18px;bottom:132px;z-index:65;min-height:42px;padding:8px 12px;border:1px solid rgba(255,255,255,.4);border-radius:999px;color:#fff;background:#164f63;box-shadow:0 8px 22px rgba(0,0,0,.2);font:inherit;font-size:.72rem;font-weight:900;cursor:pointer}
    #cockpit-health-launch[data-alert="true"]{background:#9a4035}
    #cockpit-health-panel{position:fixed;right:18px;bottom:180px;z-index:66;width:min(380px,calc(100vw - 28px));max-height:min(72vh,620px);overflow:auto;padding:16px;border:1px solid #b9d8dd;border-radius:18px;color:#173f4e;background:#f8fcfc;box-shadow:0 22px 55px rgba(0,0,0,.25)}
    #cockpit-health-panel[hidden]{display:none}#cockpit-health-panel header{display:flex;align-items:start;justify-content:space-between;gap:12px}#cockpit-health-panel h2{margin:0;color:#073a52;font-size:1rem}#cockpit-health-panel p{margin:5px 0 12px;color:#577480;font-size:.72rem;line-height:1.45}
    .cockpit-health-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.cockpit-health-metric{min-width:0;padding:9px;border:1px solid #d7e8ea;border-radius:10px;background:#fff}.cockpit-health-metric b{display:block;color:#56747f;font-size:.62rem;text-transform:uppercase}.cockpit-health-metric span{display:block;margin-top:3px;overflow-wrap:anywhere;color:#123f50;font-size:.76rem;font-weight:850}
    .cockpit-health-actions{display:flex;flex-wrap:wrap;gap:7px}.cockpit-health-actions button,.cockpit-health-actions a,#cockpit-health-close{min-height:38px;padding:7px 10px;border:1px solid #bdd9dd;border-radius:9px;color:#0b6077;background:#fff;font:inherit;font-size:.68rem;font-weight:850;text-decoration:none;cursor:pointer}.cockpit-health-error{padding:9px;border-radius:9px;color:#7b3028;background:#fff0ed;font-size:.68rem;overflow-wrap:anywhere}
    body.cockpit-safe-mode::before{position:sticky;top:0;z-index:80;display:block;padding:8px 12px;content:"Mode secours — lecture seule depuis le cache; aucune écriture ni lecture réseau Firestore";color:#fff;background:#8a5b18;font-size:.72rem;font-weight:900;text-align:center}
    body.dark #cockpit-health-panel{border-color:#356372;color:#d9edf1;background:#102f3b}body.dark #cockpit-health-panel h2,body.dark .cockpit-health-metric span{color:#effbfc}body.dark #cockpit-health-panel p,body.dark .cockpit-health-metric b{color:#b6d2d9}body.dark .cockpit-health-metric{border-color:#355d69;background:#173d49}body.dark .cockpit-health-actions button,body.dark .cockpit-health-actions a,body.dark #cockpit-health-close{border-color:#4b7580;color:#e8f8fa;background:#1c4b59}
    @media(max-width:700px){#cockpit-health-launch{right:10px;bottom:126px}#cockpit-health-panel{right:7px;bottom:176px;width:calc(100vw - 14px);max-height:70vh}}
  `;
  document.head.appendChild(style);
}

function formatTime(value) {
  if (!value) return "Pas encore";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Inconnue" : date.toLocaleString("fr-CA", { dateStyle:"short", timeStyle:"medium" });
}

function render(snapshot = getClientDiagnostics()) {
  const panel = document.querySelector("#cockpit-health-panel");
  const launch = document.querySelector("#cockpit-health-launch");
  if (!panel || !launch) return;
  launch.dataset.alert = String(Boolean(snapshot.lastErrorAt));
  launch.textContent = snapshot.lastErrorAt ? "Santé · attention" : "Santé Firebase";
  const values = {
    network: snapshot.networkState === "cache-only" ? "Cache seulement" : snapshot.networkState === "online" ? "En ligne" : snapshot.networkState === "offline" ? "Hors ligne" : snapshot.networkState,
    cache: snapshot.persistenceState === "enabled" ? "Persistant autorisé" : snapshot.persistenceState === "memory" ? "Mémoire seulement" : snapshot.persistenceState,
    listeners: String(snapshot.activeListeners), documents: String(snapshot.deliveredDocuments), cached: String(snapshot.deliveredFromCache), writes: String(snapshot.confirmedWrites), sync: formatTime(snapshot.lastServerSyncAt)
  };
  Object.entries(values).forEach(([key, value]) => {
    const node = panel.querySelector(`[data-health-value="${key}"]`);
    if (node) node.textContent = value;
  });
  const listeners = panel.querySelector("[data-health-listeners]");
  if (listeners) listeners.textContent = snapshot.listenerNames.length ? snapshot.listenerNames.join(", ") : "Aucun listener actif";
  const error = panel.querySelector("[data-health-error]");
  if (error) {
    error.hidden = !snapshot.lastErrorAt;
    error.textContent = snapshot.lastErrorAt ? `${snapshot.lastErrorCode} · ${snapshot.lastErrorMessage} · ${formatTime(snapshot.lastErrorAt)}` : "";
  }
}

export function buildHealthWidget(profile) {
  if (profile?.role !== "admin" || document.querySelector("#cockpit-health-launch")) return;
  ensureStyles();
  const { safeMode, persistentCacheRequested } = getClientState();
  const launch = document.createElement("button");
  launch.id = "cockpit-health-launch";
  launch.type = "button";
  launch.setAttribute("aria-controls", "cockpit-health-panel");
  launch.setAttribute("aria-expanded", "false");
  const panel = document.createElement("aside");
  panel.id = "cockpit-health-panel";
  panel.hidden = true;
  panel.innerHTML = `<header><div><h2>Santé de la session</h2><p>Estimations locales seulement. Ouvrir ce panneau n’ajoute aucune lecture Firebase.</p></div><button id="cockpit-health-close" type="button" aria-label="Fermer le panneau de santé">Fermer</button></header><div class="cockpit-health-grid"><div class="cockpit-health-metric"><b>Réseau</b><span data-health-value="network"></span></div><div class="cockpit-health-metric"><b>Cache</b><span data-health-value="cache"></span></div><div class="cockpit-health-metric"><b>Listeners actifs</b><span data-health-value="listeners"></span></div><div class="cockpit-health-metric"><b>Documents livrés</b><span data-health-value="documents"></span></div><div class="cockpit-health-metric"><b>Depuis le cache</b><span data-health-value="cached"></span></div><div class="cockpit-health-metric"><b>Écritures confirmées</b><span data-health-value="writes"></span></div><div class="cockpit-health-metric" style="grid-column:1/-1"><b>Dernière synchronisation serveur</b><span data-health-value="sync"></span></div></div><p><b>Listeners :</b> <span data-health-listeners></span></p><p class="cockpit-health-error" data-health-error hidden></p><div class="cockpit-health-actions"><button type="button" data-health-action="${safeMode ? "normal" : "safe"}">${safeMode ? "Revenir au mode normal" : "Passer en mode secours"}</button><button type="button" data-health-action="cache">${persistentCacheRequested ? "Utiliser le cache mémoire" : "Autoriser le cache hors ligne"}</button><button type="button" data-health-action="forget">Oublier cet appareil</button><a href="https://console.firebase.google.com/project/${encodeURIComponent(globalThis.COCKPIT_FIREBASE_CONFIG?.projectId || "")}/overview" target="_blank" rel="noopener noreferrer">Console Firebase ↗</a></div>`;
  const setOpen = (open) => { panel.hidden = !open; launch.setAttribute("aria-expanded", String(open)); if (open) render(); };
  launch.addEventListener("click", () => setOpen(panel.hidden));
  panel.querySelector("#cockpit-health-close").addEventListener("click", () => setOpen(false));
  panel.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-health-action]")?.dataset.healthAction;
    if (action === "safe") requestSafeMode(true);
    if (action === "normal") requestSafeMode(false);
    if (action === "cache") { setPersistentCachePreference(!persistentCacheRequested); location.reload(); }
    if (action === "forget" && confirm("Fermer la session et supprimer le cache Firestore privé de cet appareil?")) {
      try { await forgetThisDevice(); location.assign(location.pathname); }
      catch (error) { const node = panel.querySelector("[data-health-error]"); node.hidden = false; node.textContent = `Cache non supprimé · ${error.message}`; }
    }
  });
  document.body.append(launch, panel);
  unsubscribeDiagnostics?.();
  unsubscribeDiagnostics = subscribeClientDiagnostics(render);
}

export function clearHealthWidget() {
  unsubscribeDiagnostics?.();
  unsubscribeDiagnostics = null;
  document.querySelector("#cockpit-health-launch")?.remove();
  document.querySelector("#cockpit-health-panel")?.remove();
}
