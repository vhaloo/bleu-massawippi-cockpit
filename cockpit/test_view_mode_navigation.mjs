import assert from "node:assert/strict";
import { parseHTML } from "linkedom";

const { document, window } = parseHTML(`<!doctype html><html lang="fr"><head></head><body>
  <div id="cockpit-session" data-uid="annie"><span id="cockpit-session-label">Connecté · rôle director</span><button id="cockpit-logout">Sortir</button></div>
  <main id="cockpit-content">
    <div class="hero"></div>
    <nav class="nav"><div class="wrap"><a href="#cap">Cap</a><a href="#projets">Projets</a><a href="#calendrier">Calendrier</a></div></nav>
    <section id="cap" hidden><details id="cap-details"><summary>Le cap</summary><p>Contexte.</p></details></section>
    <details id="context-collapsible"><summary>Stratégie</summary><article id="site-niveau-lac-rapport-2025"><h3>Niveau du lac et barrage — des repères utiles</h3></article></details>
    <section id="projets"><details id="projects-hub"><summary>Registre des projets</summary><details data-internal-project-id="project-one"><summary>Projet test</summary></details></details></section>
    <section id="calendrier">
      <input id="search" value=""><select id="week"><option value="all" selected>Toutes</option><option value="2">2</option></select>
      <select id="theme"><option value="all" selected>Tous</option><option value="Nature">Nature</option></select>
      <button id="past-toggle" data-active="false">Voir le passé</button>
      <div id="posts"></div>
    </section>
  </main>
  <aside id="cockpit-sidebar"><div id="cockpit-task-list">
    <article class="cockpit-task-item" data-task-id="admin-task" data-task-assignee-role="admin" data-task-target-type="schedule" data-task-target="future-4" data-task-updated-at="200">
      <b>Action réservée aux communications</b><p>Ne doit jamais apparaître pour la direction.</p>
      <button data-open-task="admin-task" data-task-target-type="schedule" data-task-target="future-4">Ouvrir</button>
    </article>
  </div></aside>
  <div id="cockpit-announcer" aria-live="polite"></div>
</body></html>`);

Object.defineProperty(document, "readyState", { configurable: true, value: "loading" });
const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};
Object.assign(globalThis, {
  document,
  window,
  localStorage,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  MutationObserver: window.MutationObserver,
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
});
const appBadgeCalls = [];
let appBadgeClearCalls = 0;
const systemNotifications = [];
let notificationPermissionRequests = 0;
const serviceWorkerListeners = new Map();
const serviceWorkerRegistration = {
  showNotification: async (title, options) => { systemNotifications.push({ title, options }); },
  getNotifications: async () => []
};
const serviceWorker = {
  ready: Promise.resolve(serviceWorkerRegistration),
  addEventListener(type, handler) { serviceWorkerListeners.set(type, handler); },
  removeEventListener(type, handler) { if (serviceWorkerListeners.get(type) === handler) serviceWorkerListeners.delete(type); },
  dispatchMessage(data) { serviceWorkerListeners.get("message")?.({ data }); }
};
class TestNotification {
  static permission = "default";
  static async requestPermission() {
    notificationPermissionRequests += 1;
    TestNotification.permission = "granted";
    return "granted";
  }
}
globalThis.Notification = TestNotification;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    onLine: true,
    serviceWorker,
    setAppBadge: (...args) => { appBadgeCalls.push(args); return Promise.resolve(); },
    clearAppBadge: () => { appBadgeClearCalls += 1; return Promise.resolve(); }
  }
});
Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
document.hasFocus = () => true;
function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(globalThis, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: width });
}
setViewportWidth(1366);
Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
Object.defineProperty(globalThis, "innerHeight", { configurable: true, value: 900 });
window.localStorage = localStorage;
window.matchMedia = globalThis.matchMedia;
Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
  configurable: true,
  get() { return this.querySelector("option[selected]")?.getAttribute("value") || ""; },
  set(value) {
    this.querySelectorAll("option").forEach((option) => {
      if (option.getAttribute("value") === String(value)) option.setAttribute("selected", "");
      else option.removeAttribute("selected");
    });
  }
});
const scrollCalls = [];
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
  this.__scrollOptions = options;
  scrollCalls.push({ element: this, options });
};
window.HTMLElement.prototype.focus = function focus() { this.dataset.testFocused = "true"; };

const wait = (milliseconds = 120) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const eventContextRequests = [];
window.addEventListener("cockpit:event-context-request", (event) => {
  eventContextRequests.push(String(event.detail?.eventId || ""));
});
function switchTestRole(uid, role) {
  const session = document.querySelector("#cockpit-session");
  session.dataset.uid = uid;
  document.querySelector("#cockpit-session-label").textContent = `Connecté · rôle ${role}`;
  document.body.classList.toggle("cockpit-admin", role === "admin");
  window.dispatchEvent(new window.CustomEvent("cockpit:session-ready", { detail: { profile: { uid, role } } }));
}
const isoDate = (day) => `2026-07-${String(day).padStart(2, "0")}`;
const frenchDate = (day) => `${day} juillet 2026`;

globalThis.posts = [
  { id: "past", title: "Publication passée", dateIso: isoDate(13), date: frenchDate(13), t: "Patrimoine", w: 1 },
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `future-${index + 1}`,
    title: `Décision future ${index + 1}`,
    dateIso: isoDate(15 + index),
    date: frenchDate(15 + index),
    t: index === 1 ? "Nature" : "Communauté",
    w: index < 4 ? 1 : 2,
    hiddenCard: index === 1,
    requiresContactOwnership: index === 0,
    coordinationLabel: index === 0 ? "Préparation requise · personne réelle, premier contact, coordination et consentement" : "",
    coordinationDecisionMinutesAnnie: index === 0 ? 15 : 0
  }))
];

let showPast = false;
function cardMarkup(item) {
  return `<article class="post${item.hiddenCard ? " is-deleted" : ""}" data-item-id="${item.id}" data-workflow-stage="content_review" data-workflow-updated-at="100"${item.hiddenCard ? " hidden" : ""}>
    <div class="post-head"><span class="date">${item.date}</span><h4>${item.title}</h4></div>
    <details><summary>Ouvrir le brief complet</summary><div class="detail">Brief</div></details>
    <div class="cockpit-controls">
      <button data-gate="content" class="current" aria-pressed="false"><b>1 · Texte</b><span data-gate-label>Prêt pour validation</span></button>
      <button data-gate="media" aria-pressed="false"><b>2 · Média</b><span data-gate-label>Attend le texte</span></button>
      <button data-gate="publication" aria-pressed="false"><b>3 · Terminé</b><span data-gate-label>Attend les validations</span></button>
      <div data-workflow-actions><button class="primary">Approuver le texte</button></div>
      <details class="cockpit-media"><summary>Médias OneDrive</summary><div class="cockpit-media-card" data-media-id="media-${item.id}" data-media-stage="draft"><details class="cockpit-media-info"><summary>Informations et actions</summary></details></div></details>
    </div>
  </article>`;
}

function isPast(item) { return item.dateIso < "2026-07-14"; }
function renderCalendar() {
  const query = document.querySelector("#search").value.toLowerCase();
  const week = document.querySelector("#week").value;
  const theme = document.querySelector("#theme").value;
  const visible = globalThis.posts.filter((item) =>
    item.archivedEditorial !== true
    && (showPast || !isPast(item))
    && (week === "all" || String(item.w) === week)
    && (theme === "all" || item.t === theme)
    && (!query || `${item.title} ${item.t}`.toLowerCase().includes(query))
  );
  document.querySelector("#posts").innerHTML = visible.map(cardMarkup).join("");
  const toggle = document.querySelector("#past-toggle");
  toggle.dataset.active = String(showPast);
}

document.querySelector("#search").addEventListener("input", renderCalendar);
document.querySelector("#week").addEventListener("change", renderCalendar);
document.querySelector("#theme").addEventListener("change", renderCalendar);
document.querySelector("#past-toggle").addEventListener("click", () => { showPast = !showPast; renderCalendar(); });
renderCalendar();

const viewMode = await import(`./view-mode.js?navigation-test=${Date.now()}`);
viewMode.init({ profile: { uid: "annie", role: "director" }, now: new Date("2026-07-14T12:00:00-04:00"), contentNoticeDwellMs: 20, attentionDwellMs: 60, decisionDockMinWidth: 1180, decisionDockAvailableWidth: 360 });
await wait();

const decisionCards = () => [...document.querySelectorAll(".vm-decisions .vm-event")];

// La direction ne reçoit jamais la tâche des communications et sa première
// fenêtre reste petite, triée et paginable sans requête supplémentaire.
assert.equal(document.body.classList.contains("cockpit-view-essential"), true);
const initialPanels = [...document.querySelectorAll(".vm-dashboard-grid > .vm-panel")];
assert.ok(initialPanels[0].classList.contains("vm-decisions"), "Les décisions doivent être le premier panneau.");
assert.ok(initialPanels[1].classList.contains("vm-week"), "Les sept prochains jours doivent suivre les décisions.");
assert.ok(initialPanels[2].classList.contains("vm-today") && initialPanels[2].classList.contains("vm-compact"), "Aujourd'hui doit rester disponible dans un panneau compact.");
assert.ok(initialPanels[3].classList.contains("vm-messages") && initialPanels[3].classList.contains("vm-compact"), "Les messages doivent rester disponibles dans un panneau compact.");
const essentialNav = [...document.querySelectorAll(".nav .wrap > [data-vm-nav]")];
assert.equal(essentialNav[0].dataset.vmNav, "decision", "Le raccourci Décisions doit être le premier.");
assert.equal(essentialNav[1].dataset.vmNav, "today", "Le raccourci Aujourd'hui doit être le deuxième.");
assert.equal(decisionCards().length, 5, "La file initiale DG doit rester bornée à cinq décisions.");
assert.ok([...document.querySelectorAll(".vm-decisions .vm-time-estimate")].every((node) => /min|h/.test(node.textContent)), "Chaque décision visible doit annoncer une durée approximative.");
const interviewDecision = document.querySelector('[data-vm-target="future-1"]').closest(".vm-event");
assert.match(interviewDecision.textContent, /Attribuer le premier contact et la coordination/);
assert.match(interviewDecision.querySelector(".vm-time-estimate").textContent, /15 min/);
assert.ok(document.querySelector('[data-vm-target="future-1"]').closest(".vm-event").classList.contains("priority-urgent"), "Le 15 juillet à 7 h 30 doit être urgent à moins de 48 h.");
assert.ok(decisionCards().some((card) => card.classList.contains("priority-current-week")), "Le reste de la semaine doit être orange, sans urgence pulsante.");
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Action réservée aux communications/);
assert.ok(document.querySelector("[data-vm-load-more]"), "La suite de la file doit être disponible à la demande.");

// La notification de nouveauté est strictement locale à l'identité, sans compteur ni
// lecture supplémentaire. Un coup d'œil réel ou le bouton manuel l'efface.
const attentionDot = () => document.querySelector('[data-vm-nav="decision"] [data-vm-attention-dot]');
assert.equal(attentionDot().hidden, false, "Une file personnelle jamais vue doit allumer le point de nouveauté.");
assert.ok(appBadgeCalls.length > 0, "L’application installée doit recevoir le badge lorsque l’API existe.");
assert.ok(appBadgeCalls.every((args) => args.length === 0), "Le badge système doit être un point, jamais un nombre.");
assert.match(document.querySelector("[data-vm-attention-title]").textContent, /Nouveautés à voir/);
const systemNotificationToggle = document.querySelector("[data-vm-system-notification]");
assert.ok(systemNotificationToggle, "Le réglage des alertes système doit être proposé sans listener Firestore supplémentaire.");
systemNotificationToggle.click();
await wait();
assert.equal(notificationPermissionRequests, 1, "La permission système doit être demandée uniquement après le clic explicite.");
assert.equal(systemNotificationToggle.getAttribute("aria-pressed"), "true");
assert.ok(systemNotifications.some((entry) => /^cockpit-notification-ready-/.test(entry.options.tag)), "Une confirmation discrète et propre au compte doit prouver que le canal système fonctionne.");
document.querySelector("[data-vm-attention-seen]").click();
assert.equal(attentionDot().hidden, true, "Le bouton manuel doit retirer immédiatement la notification.");
assert.ok(appBadgeClearCalls > 0);
assert.ok([...storage.keys()].some((key) => key.includes("bleu-massawippi-attention-v1:uid:annie")), "L’état vu doit rester isolé à l’uid sur cet appareil.");
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.equal(attentionDot().hidden, true, "Un rendu identique ne doit jamais rallumer la nouveauté.");
document.querySelector('[data-item-id="future-1"]').dataset.workflowUpdatedAt = "101";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.equal(attentionDot().hidden, false, "Une décision modifiée après lecture doit rallumer le point.");
const visibleDecisionPanel = document.querySelector("#vm-panel-decision");
visibleDecisionPanel.getBoundingClientRect = () => ({ top: 160, bottom: 650, left: 80, right: 720, width: 640, height: 490 });
window.dispatchEvent(new window.Event("scroll"));
await wait(320);
assert.equal(attentionDot().hidden, true, "Une consultation visible et suffisamment longue doit retirer le point sans clic métier.");
const attentionToggle = document.querySelector("[data-vm-attention-toggle]");
attentionToggle.click();
assert.equal(attentionToggle.getAttribute("aria-pressed"), "false", "Les notifications doivent pouvoir être désactivées uniquement sur cet appareil.");
document.querySelector('[data-item-id="future-3"]').dataset.workflowUpdatedAt = "102";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.equal(attentionDot().hidden, true, "Une nouveauté ne doit pas réapparaître tant que les notifications locales sont désactivées.");
document.querySelector("[data-vm-attention-toggle]").click();
assert.equal(attentionDot().hidden, false, "Réactiver les notifications doit révéler une décision réellement nouvelle.");
document.querySelector("[data-vm-attention-seen]").click();

// Une nouveauté reçue pendant que l’application est en arrière-plan réutilise
// la file déjà chargée : une alerte sans compteur, sans nouvelle requête.
Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
document.hasFocus = () => false;
document.querySelector('[data-item-id="future-4"]').dataset.workflowUpdatedAt = "103";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
const attentionNotification = systemNotifications.findLast((entry) => /^cockpit-attention-/.test(entry.options.tag));
assert.ok(attentionNotification, "Une nouveauté personnelle en arrière-plan doit produire une notification système.");
assert.match(attentionNotification.title, /nouveautés à voir/i);
assert.match(attentionNotification.options.body, /actions personnelles/i);
assert.equal(attentionNotification.options.data.url, "./?notification=decisions");
Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
document.hasFocus = () => true;
serviceWorker.dispatchMessage({ type: "cockpit-open-attention" });
await wait();
assert.ok(scrollCalls.some(({ element }) => element.id === "vm-panel-decision"), "Cliquer la notification doit ramener aux décisions personnelles.");

// Toutes les cartes commencent compactes, dans les deux vues. L'en-tête agit
// comme « Ouvrir », tous les sous-panneaux suivent et l'état reste local à
// l'utilisateur, sans écriture distante.
const headerCard = document.querySelector('[data-item-id="future-3"]');
const clickableHeader = headerCard.querySelector(':scope > .post-head');
const headerToggle = headerCard.querySelector('[data-vm-card-toggle]');
assert.ok([...document.querySelectorAll('.post[data-item-id]')].every((card) => !card.classList.contains('vm-expanded')),
  'Toutes les publications doivent être réduites par défaut.');
assert.ok([...headerCard.querySelectorAll('details')].every((details) => !details.hasAttribute('open')),
  'Aucun sous-panneau ne doit rester ouvert dans une carte réduite.');
assert.equal(headerCard.querySelectorAll('.vm-card-progress .state-active').length, 1,
  'L’étape active doit être orange dans le résumé.');
assert.equal(headerCard.querySelectorAll('.vm-card-progress .state-pending').length, 2,
  'Les étapes encore bloquées doivent être rouges dans le résumé.');
assert.equal(clickableHeader.getAttribute('role'), 'button');
assert.equal(clickableHeader.getAttribute('tabindex'), '0');
assert.equal(clickableHeader.getAttribute('aria-expanded'), 'false');
clickableHeader.click();
assert.equal(headerCard.classList.contains('vm-expanded'), true);
assert.ok([...headerCard.querySelectorAll('details')].every((details) => details.hasAttribute('open')),
  'Ouvrir une publication doit ouvrir tous ses sous-panneaux en un seul geste.');
assert.equal(clickableHeader.getAttribute('aria-expanded'), 'true');
assert.match(headerToggle.textContent, /Réduire/);
assert.equal(storage.get('bleu-massawippi-card-expansion-v1:uid:annie:future-3'), 'open');
clickableHeader.click();
assert.equal(headerCard.classList.contains('vm-expanded'), false);
assert.ok([...headerCard.querySelectorAll('details')].every((details) => !details.hasAttribute('open')),
  'Réduire une publication doit refermer tous ses sous-panneaux.');
assert.equal(storage.get('bleu-massawippi-card-expansion-v1:uid:annie:future-3'), 'closed');
const enterKey = new window.Event('keydown', { bubbles: true, cancelable: true });
Object.defineProperty(enterKey, 'key', { value: 'Enter' });
clickableHeader.dispatchEvent(enterKey);
assert.equal(headerCard.classList.contains('vm-expanded'), true, 'Entrée doit ouvrir la publication.');
const nestedControl = document.createElement('button');
nestedControl.textContent = 'Contrôle interne';
clickableHeader.appendChild(nestedControl);
nestedControl.click();
assert.equal(headerCard.classList.contains('vm-expanded'), true, 'Un contrôle interne ne doit pas replier la publication.');
renderCalendar();
window.dispatchEvent(new window.CustomEvent('cockpit:data-updated'));
await wait();
const restoredDirectorCard = document.querySelector('[data-item-id="future-3"]');
assert.equal(restoredDirectorCard.classList.contains('vm-expanded'), true,
  'Une publication laissée ouverte doit le rester après un nouveau rendu.');
assert.ok([...restoredDirectorCard.querySelectorAll('details')].every((details) => details.hasAttribute('open')));

const firstOpenControl = document.querySelector('.vm-decisions [data-vm-target="future-1"]');
assert.ok(firstOpenControl, "La recette doit fournir une première cible future déjà visible.");
const firstOpenTarget = firstOpenControl.dataset.vmTarget;
firstOpenControl.click();
await wait(250);
assert.equal(document.querySelector(`.post[data-item-id="${firstOpenTarget}"]`).classList.contains("vm-expanded"), true);
assert.equal(scrollCalls.at(-1)?.element.closest?.(".post[data-item-id]")?.dataset.itemId, firstOpenTarget,
  "Chaque bouton de la direction doit positionner le calendrier sur son événement exact.");
assert.equal(scrollCalls.at(-1)?.options?.behavior, "auto",
  "La navigation doit éviter le long scroll doux qui pouvait être interrompu par un rerendu.");
assert.match(firstOpenControl.textContent, /Ouvrir/, "Le bouton doit retrouver son libellé après la navigation.");

// Quand une décision visible sort de la file, la suivante remonte sans charger
// de données nouvelles : le tableau est seulement recalculé depuis le DOM.
const firstVisibleId = document.querySelector(".vm-decisions [data-vm-target]").dataset.vmTarget;
const firstVisibleCard = document.querySelector(`.post[data-item-id="${firstVisibleId}"]`);
firstVisibleCard.dataset.workflowStage = "scheduled";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.equal(decisionCards().length, 5, "La fenêtre doit se remplir automatiquement après traitement.");
assert.equal(document.querySelector(`.vm-decisions [data-vm-target="${firstVisibleId}"]`), null);

document.querySelector("[data-vm-load-more]").click();
await wait(30);
assert.equal(decisionCards().length, 7, "La page locale suivante doit afficher toute la file restante sans en perdre une.");
assert.match(document.querySelector(".vm-queue-end").textContent, /toutes vos décisions chargées/i);

// Un rôle communications ne reçoit que sa propre tâche matérialisée.
  switchTestRole("valentin", "admin");
  await wait();
  const adminIdentityCard = document.querySelector('[data-item-id="future-3"]');
  assert.equal(document.body.classList.contains('cockpit-view-complete'), true);
  assert.equal(adminIdentityCard.classList.contains('vm-expanded'), false,
    'La préférence ouverte de la direction ne doit jamais contaminer le compte des communications.');
  assert.equal(adminIdentityCard.querySelector(':scope > .post-head').getAttribute('role'), 'button',
    'La carte doit rester ouvrable dans la vue complète des communications.');
  assert.match(document.querySelector(".vm-decisions").textContent, /Action réservée aux communications/);
  document.body.dataset.workflowSync = "pending";
  window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
  await wait();
  assert.match(document.querySelector(".vm-decisions").textContent, /Synchronisation en cours/,
    "La vue mobile ne doit pas afficher le plan statique comme une décision actuelle avant le workflow serveur.");
  assert.equal(document.querySelectorAll(".vm-decisions .vm-event").length, 0);
  document.body.dataset.workflowSync = "server";
  window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
  await wait();
  assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Synchronisation en cours/);
  assert.ok(document.querySelectorAll(".vm-decisions .vm-event").length > 0,
    "Les décisions doivent réapparaître automatiquement dès la confirmation serveur.");
  const adminTaskOpen = document.querySelector('.vm-decisions [data-vm-task="admin-task"]');
  assert.ok(adminTaskOpen, "Une tâche persistante doit conserver une ouverture ciblée dans la file compacte.");
  const adminTaskComplete = adminTaskOpen.closest(".vm-event").querySelector('[data-complete-task="admin-task"]');
  assert.ok(adminTaskComplete, "Les communications doivent pouvoir classer leur tâche comme faite à côté d’Ouvrir.");
  assert.match(adminTaskComplete.textContent, /C’est fait/);
  document.body.dataset.workflowSync = "cache";
  document.body.classList.add("cockpit-safe-mode");
  window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
  await wait();
  assert.match(document.querySelector(".vm-decisions").textContent, /Mode hors ligne/,
    "Le mode secours doit conserver la file du cache tout en signalant clairement sa fraîcheur.");
  document.body.classList.remove("cockpit-safe-mode");
  document.body.dataset.workflowSync = "server";
  window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
  await wait();
  const completedAdminCard = document.querySelector('[data-item-id="future-4"]');
  completedAdminCard.dataset.workflowStage = "scheduled";
  completedAdminCard.dataset.workflowUpdatedAt = "300";
  document.querySelector('[data-task-id="admin-task"]').dataset.taskUpdatedAt = "400";
  await wait();
  assert.equal(document.querySelector('.vm-decisions [data-vm-target="future-4"]'), null,
    "Même une ancienne tâche techniquement plus récente ne doit pas ressusciter un événement terminé.");
  completedAdminCard.dataset.workflowStage = "content_review";
  completedAdminCard.classList.add("editorial-rejected");
  window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
  await wait();
  assert.equal(document.querySelector('.vm-decisions [data-vm-target="future-4"]'), null,
    "Une ancienne tâche technique ne doit jamais ressusciter un angle éditorial écarté et archivé.");
  completedAdminCard.classList.remove("editorial-rejected");
  completedAdminCard.dataset.workflowStage = "content_review";
  completedAdminCard.dataset.workflowUpdatedAt = "100";
  switchTestRole("annie", "director");
await wait();
assert.equal(document.querySelector('[data-item-id="future-3"]').classList.contains('vm-expanded'), true,
  'Le retour au compte de la direction doit restaurer sa propre préférence.');
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Action réservée aux communications/);

// Une action Firestore personnelle devient prioritaire, reste strictement
// liée au rôle et transporte eventId + mediaId jusqu’au média exact.
const actionSource = document.createElement("section");
actionSource.id = "cockpit-action-item-source";
actionSource.hidden = true;
actionSource.dataset.hasMore = "true";
actionSource.innerHTML = `<article data-action-item-id="media-direction-approval-alt" data-action-assignee-uid="annie" data-action-assignee-role="director" data-action-target-type="schedule" data-action-target="future-2" data-action-media="media-future-2" data-action-type="approve_text_then_media" data-action-priority="10" data-action-date="2026-07-16" data-action-updated-at="500"><b>Vérifier le visuel recommandé</b><p>Le texte demeure la première porte; le visuel vient ensuite.</p></article>
<article data-action-item-id="content-notice-project-one-v1" data-action-assignee-role="director" data-action-target-type="internalProject" data-action-target="project-one" data-action-type="content_notice" data-action-priority="40" data-action-date="2026-07-14" data-action-updated-at="510"><b>Nouveau — Projet test</b><p>Vous pouvez simplement y jeter un coup d’œil.</p></article>`;
document.body.appendChild(actionSource);
window.dispatchEvent(new window.CustomEvent("cockpit:action-items-updated"));
await wait();
assert.match(document.querySelector(".vm-decisions").textContent, /Vérifier le visuel recommandé/);
const mediaActionComplete = document.querySelector('[data-vm-complete-action-item="media-direction-approval-alt"]');
assert.ok(mediaActionComplete, "Une action Firestore personnelle doit offrir C’est fait à côté d’Ouvrir.");
assert.match(mediaActionComplete.textContent, /C’est fait/);
switchTestRole("direction-colleague", "director");
await wait();
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Vérifier le visuel recommandé/,
  "Une collègue ayant le même rôle ne doit pas recevoir l’action nominativement attribuée à Annie.");
assert.match(document.querySelector(".vm-decisions").textContent, /Nouveau — Projet test/,
  "Une action volontairement attribuée au rôle reste visible pour l’équipe concernée.");
switchTestRole("annie", "director");
await wait();
const noticeControl = document.querySelector('.vm-decisions [data-vm-action-item-id="content-notice-project-one-v1"]');
assert.ok(noticeControl, "Une nouveauté non quotidienne doit rejoindre la file personnelle de la direction.");
const noticeCard = noticeControl.closest(".vm-event");
assert.ok(noticeCard.classList.contains("priority-notice"));
assert.match(noticeCard.textContent, /★ Nouveauté/);
assert.equal(noticeCard.querySelector(".vm-time-estimate"), null, "Une simple nouveauté ne doit afficher aucune estimation de temps.");
const projectTarget = document.querySelector('[data-internal-project-id="project-one"]');
projectTarget.getBoundingClientRect = () => ({ top: 180, bottom: 500, left: 160, right: 900, width: 740, height: 320 });
let seenNotice = null;
window.addEventListener("cockpit:content-notice-seen", (event) => { seenNotice = event.detail; }, { once: true });
noticeControl.click();
await wait(120);
assert.equal(projectTarget.hasAttribute("open"), true, "La nouveauté doit ouvrir précisément le projet ciblé.");
assert.equal(document.querySelector("#projects-hub").hasAttribute("open"), true, "Le registre parent doit aussi être révélé.");
assert.equal(seenNotice?.actionItemId, "content-notice-project-one-v1", "La lecture ne doit être confirmée qu’après une visibilité réelle et bornée.");

// La file flottante réutilise exactement les décisions déjà chargées. Elle
// apparaît seulement pour la direction sur ordinateur, puis revient à sa place.
let decisionPanel = document.querySelector("#vm-panel-decision");
decisionPanel.getBoundingClientRect = () => ({ top: -420, bottom: 80, left: 0, right: 700, width: 700, height: 500 });
window.dispatchEvent(new window.Event("scroll"));
const dock = document.querySelector("#vm-decision-dock");
const dockTab = document.querySelector("#vm-decision-dock-tab");
assert.ok(dock.classList.contains("is-visible"), "La file doit suivre la direction après le défilement sur ordinateur.");
assert.equal(dockTab.classList.contains("is-visible"), false, "La languette doit se ranger lorsque le panneau tient sans chevaucher le contenu.");
assert.match(dock.textContent, /Nouveau — Projet test/);
dock.querySelector("[data-vm-dock-toggle]").click();
assert.equal(dock.classList.contains("is-visible"), false, "Le panneau doit pouvoir disparaître entièrement.");
assert.ok(dockTab.classList.contains("is-visible"), "Une grande languette doit rester disponible après la réduction.");
assert.match(dockTab.textContent, /Mes décisions/);
dockTab.click();
assert.ok(dock.classList.contains("is-visible"), "La languette doit rouvrir le panneau.");

// Si la gouttière latérale devient trop étroite, le panneau se range sans
// recouvrir le texte. La languette permet néanmoins une ouverture temporaire.
viewMode.update({ decisionDockAvailableWidth: 170 });
await wait();
decisionPanel = document.querySelector("#vm-panel-decision");
decisionPanel.getBoundingClientRect = () => ({ top: -420, bottom: 80, left: 0, right: 700, width: 700, height: 500 });
window.dispatchEvent(new window.Event("scroll"));
assert.ok(dock.classList.contains("is-overlay"), "Une ouverture demandée doit rester possible en superposition temporaire.");
window.dispatchEvent(new window.Event("resize"));
assert.equal(dock.classList.contains("is-visible"), false, "Un redimensionnement sans place doit ranger automatiquement le panneau.");
assert.ok(dockTab.classList.contains("is-visible"), "La languette doit rester accessible quand le panneau ne tient plus.");
dockTab.click();
assert.ok(dock.classList.contains("is-overlay"), "La languette doit rouvrir le panneau même sur une largeur contrainte.");

// Sur un portable sans gouttière latérale, le raccourci rejoint aussi le
// sommaire : la largeur de l'écran seule ne doit pas l'autoriser à recouvrir
// les premières lettres d'une publication.
viewMode.update({ decisionDockAvailableWidth: 40 });
await wait();
decisionPanel = document.querySelector("#vm-panel-decision");
decisionPanel.getBoundingClientRect = () => ({ top: -420, bottom: 80, left: 0, right: 700, width: 700, height: 500 });
setViewportWidth(1280);
window.dispatchEvent(new window.Event("resize"));
assert.equal(dockTab.parentElement, document.querySelector(".nav .wrap"), "La languette d'un portable sans gouttière doit rejoindre le sommaire.");
assert.ok(dockTab.classList.contains("is-inline"), "La variante compacte doit protéger le contenu aux largeurs intermédiaires.");

// Sur téléphone, la languette rejoint le sommaire collant : elle participe à
// la mise en page au lieu de recouvrir le texte ou une publication.
setViewportWidth(390);
window.dispatchEvent(new window.Event("resize"));
assert.equal(dock.classList.contains("is-visible"), false, "Le panneau mobile doit rester fermé jusqu’à une demande explicite.");
assert.equal(dockTab.parentElement, document.querySelector(".nav .wrap"), "La languette mobile doit vivre dans le sommaire et ne jamais flotter sur le contenu.");
assert.ok(dockTab.classList.contains("is-inline"), "La variante mobile compacte doit être explicite.");
assert.ok(dockTab.classList.contains("is-visible"), "Le raccourci mobile doit rester accessible après le défilement.");
dockTab.click();
assert.ok(dock.classList.contains("is-overlay"), "Le raccourci intégré au sommaire doit ouvrir le panneau à la demande.");
viewMode.update({ decisionDockAvailableWidth: 170 });
setViewportWidth(1366);
window.dispatchEvent(new window.Event("resize"));
assert.equal(dockTab.parentElement, document.body, "La languette doit retrouver le bord de l’écran quand la largeur revient.");
assert.equal(dockTab.classList.contains("is-inline"), false, "Le style mobile ne doit pas contaminer l’ordinateur.");

viewMode.update({ decisionDockAvailableWidth: 360 });
await wait();
decisionPanel = document.querySelector("#vm-panel-decision");
decisionPanel.getBoundingClientRect = () => ({ top: -420, bottom: 80, left: 0, right: 700, width: 700, height: 500 });
window.dispatchEvent(new window.Event("scroll"));
assert.equal(dock.classList.contains("is-overlay"), false, "Le panneau doit reprendre naturellement la gouttière quand la place revient.");
decisionPanel.getBoundingClientRect = () => ({ top: 140, bottom: 640, left: 0, right: 700, width: 700, height: 500 });
window.dispatchEvent(new window.Event("scroll"));
assert.equal(dock.classList.contains("is-visible"), false, "La file flottante doit se réintégrer au tableau au retour vers le haut.");
assert.equal(dockTab.classList.contains("is-visible"), false, "La languette doit aussi disparaître lorsque le tableau principal est revenu à l’écran.");
const completedActionCard = document.querySelector('[data-item-id="future-2"]');
completedActionCard.dataset.workflowStage = "published";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Vérifier le visuel recommandé/,
  "Une action personnelle encore pending dans Firestore doit être élaguée dès que la publication est terminée.");
completedActionCard.dataset.workflowStage = "content_review";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
const mediaAction = document.querySelector('.vm-decisions [data-vm-target="future-2"][data-vm-media="media-future-2"]');
assert.ok(mediaAction, "L’action personnelle doit transporter la cible média exacte.");
mediaAction.click();
await wait(250);
assert.equal(document.querySelector('[data-item-id="future-2"] details.cockpit-media-info').hasAttribute("open"), true);
switchTestRole("valentin", "admin");
await wait();
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Vérifier le visuel recommandé/);
decisionPanel = document.querySelector("#vm-panel-decision");
decisionPanel.getBoundingClientRect = () => ({ top: -420, bottom: 80, left: 0, right: 700, width: 700, height: 500 });
window.dispatchEvent(new window.Event("scroll"));
assert.ok(dock.classList.contains("is-visible"), "La file flottante doit aussi être disponible pour les communications.");
assert.match(dock.querySelector("[data-vm-dock-eyebrow]").textContent, /Communications/);
assert.match(dock.querySelector("[data-vm-dock-title]").textContent, /À accomplir maintenant/);
assert.match(dockTab.textContent, /Mes tâches/, "La languette admin doit nommer clairement sa propre file.");

// Un original historique peut devenir le visuel final sans changer son rôle de
// source documentaire. Dès que les communications l'ont recommandé et remis à
// la direction, leur tour est terminé : l'événement quitte leur file, mais il
// apparaît immédiatement dans celle de la direction pour la validation finale.
const handedOffSourceCard = document.querySelector('[data-item-id="future-3"]');
const handedOffSourceMedia = handedOffSourceCard.querySelector('.cockpit-media-card');
const handedOffOtherStages = [...document.querySelectorAll('.post[data-item-id]')]
  .filter((card) => card !== handedOffSourceCard)
  .map((card) => [card, card.dataset.workflowStage]);
handedOffOtherStages.forEach(([card]) => { card.dataset.workflowStage = "scheduled"; });
handedOffSourceCard.dataset.workflowStage = "media_review";
handedOffSourceMedia.dataset.mediaStage = "source";
handedOffSourceMedia.dataset.mediaCommunicationsSelected = "true";
handedOffSourceMedia.dataset.mediaDirectionSelected = "false";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
const adminHandoffTargets = [...document.querySelectorAll(".vm-decisions [data-vm-target]")].map((node) => node.dataset.vmTarget);
assert.equal(adminHandoffTargets.includes("future-3"), false,
  "Après remise d'un visuel source, les communications ne doivent plus voir l'événement dans leur file personnelle.");
switchTestRole("annie", "director");
await wait();
const directionSourceDecision = [...document.querySelectorAll(".vm-decisions [data-vm-target]")]
  .find((node) => node.dataset.vmTarget === "future-3")?.closest(".vm-event");
assert.ok(directionSourceDecision,
  "Le même passage de relais doit faire apparaître la validation dans la file de la direction.");
assert.match(directionSourceDecision.textContent, /Confirmer le visuel recommandé/);
handedOffSourceMedia.dataset.mediaDirectionSelected = "true";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.equal([...document.querySelectorAll(".vm-decisions [data-vm-target]")]
  .some((node) => node.dataset.vmTarget === "future-3"), false,
  "Après son choix, la direction ne doit plus conserver l'événement dans sa propre file.");
switchTestRole("valentin", "admin");
await wait();
const returnedToCommunications = [...document.querySelectorAll(".vm-decisions [data-vm-target]")]
  .find((node) => node.dataset.vmTarget === "future-3")?.closest(".vm-event");
assert.ok(returnedToCommunications,
  "Une fois le média validé par la direction, la publication doit revenir dans la file des communications.");
assert.match(returnedToCommunications.textContent, /Publier ou programmer/);
handedOffOtherStages.forEach(([card, stage]) => { card.dataset.workflowStage = stage; });
handedOffSourceCard.dataset.workflowStage = "content_review";
handedOffSourceMedia.dataset.mediaStage = "draft";
handedOffSourceMedia.dataset.mediaCommunicationsSelected = "false";
handedOffSourceMedia.dataset.mediaDirectionSelected = "false";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();

const adminDockOpen = dock.querySelector("[data-vm-target]");
const adminDockTarget = adminDockOpen.dataset.vmTarget;
adminDockOpen.click();
await wait(250);
assert.equal(scrollCalls.at(-1)?.element.closest?.(".post[data-item-id]")?.dataset.itemId, adminDockTarget,
  "Le widget des communications doit lui aussi viser l'événement porté par son propre bouton.");
switchTestRole("annie", "director");
await wait();
let remoteLoadRequests = 0;
window.addEventListener("cockpit:load-more-action-items", () => { remoteLoadRequests += 1; });
document.querySelector("[data-vm-load-more]").click();
await wait(30);
assert.equal(remoteLoadRequests, 1, "Charger plus doit demander une seule page distante.");
const sequentialCard = document.querySelector('[data-item-id="future-2"]');
  sequentialCard.dataset.workflowStage = "content_approved";
  window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
  await wait();
  assert.match(document.querySelector(".vm-decisions").textContent, /Choisir et approuver le visuel recommandé/);
  sequentialCard.querySelector(".cockpit-media-card").dataset.mediaDirectionSelected = "true";
  window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
  await wait();
  assert.equal(document.querySelector('.vm-decisions [data-vm-target="future-2"]'), null,
    "Le choix média de la direction doit retirer immédiatement sa propre décision.");
  sequentialCard.querySelector(".cockpit-media-card").dataset.mediaDirectionSelected = "false";
  sequentialCard.dataset.workflowStage = "final_approved";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /visuel recommandé/);
sequentialCard.dataset.workflowStage = "content_review";

// Le compteur Messages représente uniquement les messages entrants non lus.
// L'ouverture réussie les marque localement comme vus, sans écriture Firebase;
// une modification plus récente du même commentaire le rend de nouveau visible.
const messageHost = document.createElement("div");
messageHost.dataset.commentThread = "";
messageHost.innerHTML = `<article class="cockpit-message other" data-comment-id="comment-visible" data-created-at="600" data-updated-at="600"><header><b>💬 Communications</b><span>maintenant</span></header><p>Message à lire.</p></article><article class="cockpit-message mine" data-comment-id="comment-mine" data-created-at="601" data-updated-at="601"><header><b>💬 Annie</b><span>maintenant</span></header><p>Mon propre message.</p></article>`;
document.querySelector('[data-item-id="future-3"] .cockpit-controls').appendChild(messageHost);
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.equal(document.querySelector("[data-vm-message-count]").textContent, "1", "Le badge doit ignorer le message de la personne connectée.");
const messageOpen = document.querySelector('.vm-messages [data-vm-message-id="comment-visible"]');
assert.ok(messageOpen, "Le message entrant doit fournir un bouton de lecture traçable.");
messageOpen.click();
await wait(250);
assert.equal(document.querySelector("[data-vm-message-count]").hidden, true, "Le badge doit disparaître immédiatement après une ouverture réussie.");
assert.match(document.querySelector(".vm-messages").textContent, /Aucun message actif/);
const updatedMessage = document.createElement("article");
updatedMessage.className = "cockpit-message other";
updatedMessage.dataset.commentId = "comment-visible";
updatedMessage.dataset.createdAt = "600";
updatedMessage.dataset.updatedAt = "700";
updatedMessage.innerHTML = "<header><b>💬 Communications</b><span>modifié</span></header><p>Message modifié à relire.</p>";
const refreshedThread = document.createElement("div");
refreshedThread.dataset.commentThread = "";
refreshedThread.appendChild(updatedMessage);
document.querySelector('[data-item-id="future-3"] .cockpit-controls').appendChild(refreshedThread);
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.equal(document.querySelector("[data-vm-message-count]").textContent, "1", "Une version modifiée après lecture doit redevenir visible.");
updatedMessage.classList.add("handled");
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.equal(document.querySelector("[data-vm-message-count]").hidden, true, "Un message traité ne doit jamais rester dans le badge actif.");

// Une cible passée et filtrée est reconstruite, puis son brief et ses médias
// sont ouverts, focalisés et annoncés.
document.querySelector("#search").value = "aucun résultat";
document.querySelector("#week").value = "2";
document.querySelector("#theme").value = "Nature";
document.querySelector("#search").dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(document.querySelector('[data-item-id="past"]'), null);
assert.equal(await viewMode.navigateToEntity({ type: "schedule", id: "past" }), true);
const pastCard = document.querySelector('[data-item-id="past"]');
assert.equal(eventContextRequests.at(-1), "past",
  "Ouvrir une publication depuis une décision doit demander son contexte média ciblé.");
assert.equal(document.querySelector("#search").value, "");
assert.equal(document.querySelector("#week").value, "all");
assert.equal(document.querySelector("#theme").value, "all");
assert.equal(document.querySelector("#past-toggle").dataset.active, "true");
assert.equal(pastCard.classList.contains("vm-expanded"), true);
assert.equal(pastCard.querySelector(":scope > details").hasAttribute("open"), true);
assert.equal(pastCard.querySelector("details.cockpit-media").hasAttribute("open"), true);
assert.equal(pastCard.dataset.testFocused, "true");
assert.match(document.querySelector("#cockpit-announcer").textContent, /Élément ouvert : Publication passée/i);

// Une vue essentielle ou un ancien cache PWA peut rendre la carte sans le
// bouton du passé. La navigation doit rester fonctionnelle et ne jamais tenter
// d'appeler click() sur un contrôle absent.
const pastToggle = document.querySelector("#past-toggle");
pastToggle.remove();
assert.equal(await viewMode.navigateToEntity({ type: "schedule", id: "past" }), true);
document.querySelector("#calendrier").insertBefore(pastToggle, document.querySelector("#posts"));

// Une carte virtuellement masquée est révélée sans retirer son statut métier.
assert.equal(await viewMode.navigateToEntity({ type: "schedule", id: "future-2", mediaId: "media-future-2" }), true);
const hiddenCard = document.querySelector('[data-item-id="future-2"]');
assert.equal(hiddenCard.hidden, false);
assert.equal(hiddenCard.classList.contains("is-deleted"), true, "Le statut virtuel doit être conservé.");
assert.equal(hiddenCard.classList.contains("vm-navigation-reveal"), true);
assert.equal(hiddenCard.querySelector("details.cockpit-media-info").hasAttribute("open"), true);

// Une section masquée bascule proprement vers la vue complète et ouvre tous
// ses ancêtres. Le même chemin fonctionne à largeur mobile.
Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
assert.equal(await viewMode.navigateToEntity({ type: "section", id: "cap" }), true);
assert.equal(document.body.classList.contains("cockpit-view-complete"), true);
assert.equal(document.querySelector("#cap").hidden, false);
assert.equal(document.querySelector("#cap-details").hasAttribute("open"), true);
assert.equal(document.querySelector("#cap").dataset.testFocused, "true");

// Le calendrier des projets réutilise ce même routeur. Même si le registre et
// la fiche sont tous deux repliés, « Ouvrir le projet » doit révéler exactement
// la cible associée, sans dépendre d'un défilement vers un élément invisible.
document.querySelector("#projects-hub").removeAttribute("open");
projectTarget.removeAttribute("open");
assert.equal(await viewMode.navigateToEntity({ type: "project", id: "project-one" }), true);
assert.equal(document.querySelector("#projects-hub").hasAttribute("open"), true);
assert.equal(projectTarget.hasAttribute("open"), true);
assert.equal(projectTarget.dataset.testFocused, "true");

// La décision « Niveau du lac » ouvre son encart dédié — et non le cadre
// générique du mandat — avec le même parcours en vue mobile.
const lakeLevelTarget = document.querySelector("#site-niveau-lac-rapport-2025");
document.querySelector("#context-collapsible").removeAttribute("open");
assert.equal(await viewMode.navigateToEntity({ type: "section", id: "site-niveau-lac-rapport-2025" }), true);
assert.equal(document.querySelector("#context-collapsible").hasAttribute("open"), true, "La stratégie repliée doit s’ouvrir automatiquement.");
assert.equal(lakeLevelTarget.dataset.testFocused, "true", "Le bon encart doit recevoir le focus.");
assert.equal(scrollCalls.at(-1)?.element, lakeLevelTarget, "Le défilement final doit viser l’encart Niveau du lac lui-même.");

// Un échec n'est jamais silencieux : il propose un réessai. Le réessai peut
// réussir après l'arrivée de la cible (cas cache/reconnexion).
assert.equal(await viewMode.navigateToEntity({ type: "schedule", id: "late-target" }), false);
const error = document.querySelector("[data-vm-navigation-status]");
assert.equal(error.hidden, false);
assert.match(error.textContent, /Réessayer/i);
globalThis.posts.push({ id: "late-target", title: "Arrivée après reconnexion", dateIso: isoDate(23), date: frenchDate(23), t: "Science", w: 2 });
renderCalendar();
error.querySelector("[data-vm-retry-id]").click();
await wait(500);
assert.ok(document.querySelector('[data-item-id="late-target"].vm-expanded'));
assert.equal(error.hidden, true);

// pageshow simule un retour depuis le cache/PWA : la navigation demeure
// fonctionnelle et ne duplique pas la file.
window.dispatchEvent(new window.Event("pageshow"));
await wait();
assert.equal(await viewMode.navigateToEntity({ type: "schedule", id: "future-3" }), true);
assert.equal(scrollCalls.at(-1)?.element.closest?.(".post[data-item-id]")?.dataset.itemId, "future-3",
  "Une navigation ultérieure doit remplacer la cible précédente au lieu de revenir sur une carte ancienne.");
assert.equal(document.documentElement.classList.contains("vm-programmatic-navigation"), false,
  "Le gel d'ancrage doit toujours être retiré après le positionnement.");
assert.equal(document.querySelectorAll("#cockpit-essential-dashboard").length, 1);

viewMode.destroy();
console.log("✓ Navigation P0 et file personnelle : tests DOM réussis.");
