import assert from "node:assert/strict";
import { parseHTML } from "linkedom";

const { document, window } = parseHTML(`<!doctype html><html lang="fr"><head></head><body>
  <div id="cockpit-session" data-uid="annie"><span id="cockpit-session-label">Connecté · rôle director</span><button id="cockpit-logout">Sortir</button></div>
  <main id="cockpit-content">
    <div class="hero"></div>
    <nav class="nav"><div class="wrap"><a href="#cap">Cap</a><a href="#projets">Projets</a><a href="#calendrier">Calendrier</a></div></nav>
    <section id="cap" hidden><details id="cap-details"><summary>Le cap</summary><p>Contexte.</p></details></section>
    <section id="projets"><details data-internal-project-id="project-one"><summary>Projet test</summary></details></section>
    <section id="calendrier">
      <input id="search" value=""><select id="week"><option value="all" selected>Toutes</option><option value="2">2</option></select>
      <select id="theme"><option value="all" selected>Tous</option><option value="Nature">Nature</option></select>
      <button id="past-toggle" data-active="false">Voir le passé</button>
      <div id="posts"></div>
    </section>
  </main>
  <aside id="cockpit-sidebar"><div id="cockpit-task-list">
    <article class="cockpit-task-item" data-task-id="admin-task" data-task-assignee-role="admin" data-task-target-type="schedule" data-task-target="future-2" data-task-updated-at="200">
      <b>Action réservée aux communications</b><p>Ne doit jamais apparaître pour la direction.</p>
      <button data-open-task="admin-task" data-task-target-type="schedule" data-task-target="future-2">Ouvrir</button>
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
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) { this.__scrollOptions = options; };
window.HTMLElement.prototype.focus = function focus() { this.dataset.testFocused = "true"; };

const wait = (milliseconds = 120) => new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    hiddenCard: index === 1
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
viewMode.init({ profile: { uid: "annie", role: "director" }, now: new Date("2026-07-14T12:00:00-04:00") });
await wait();

const decisionCards = () => [...document.querySelectorAll(".vm-decisions .vm-event")];

// La direction ne reçoit jamais la tâche des communications et sa première
// fenêtre reste petite, triée et paginable sans requête supplémentaire.
assert.equal(document.body.classList.contains("cockpit-view-essential"), true);
const initialPanels = [...document.querySelectorAll(".vm-dashboard-grid > .vm-panel")];
assert.ok(initialPanels[0].classList.contains("vm-decisions"), "Les décisions doivent être le premier panneau.");
assert.ok(initialPanels[1].classList.contains("vm-today"), "Aujourd'hui doit suivre les décisions.");
const essentialNav = [...document.querySelectorAll(".nav .wrap > [data-vm-nav]")];
assert.equal(essentialNav[0].dataset.vmNav, "decision", "Le raccourci Décisions doit être le premier.");
assert.equal(essentialNav[1].dataset.vmNav, "today", "Le raccourci Aujourd'hui doit être le deuxième.");
assert.equal(decisionCards().length, 5, "La file initiale DG doit rester bornée à cinq décisions.");
assert.ok([...document.querySelectorAll(".vm-decisions .vm-time-estimate")].every((node) => /min|h/.test(node.textContent)), "Chaque décision visible doit annoncer une durée approximative.");
assert.ok(document.querySelector('[data-vm-target="future-1"]').closest(".vm-event").classList.contains("priority-urgent"), "Le 15 juillet à 7 h 30 doit être urgent à moins de 48 h.");
assert.ok(decisionCards().some((card) => card.classList.contains("priority-current-week")), "Le reste de la semaine doit être orange, sans urgence pulsante.");
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Action réservée aux communications/);
assert.ok(document.querySelector("[data-vm-load-more]"), "La suite de la file doit être disponible à la demande.");

// L'en-tête éditorial complet agit comme le bouton « Voir et décider », sans
// écriture distante. Le clavier et les contrôles internes restent sûrs.
const headerCard = document.querySelector('[data-item-id="future-3"]');
const clickableHeader = headerCard.querySelector(':scope > .post-head');
const headerToggle = headerCard.querySelector('[data-vm-card-toggle]');
assert.equal(clickableHeader.getAttribute('role'), 'button');
assert.equal(clickableHeader.getAttribute('tabindex'), '0');
assert.equal(clickableHeader.getAttribute('aria-expanded'), 'false');
clickableHeader.click();
assert.equal(headerCard.classList.contains('vm-expanded'), true);
assert.equal(clickableHeader.getAttribute('aria-expanded'), 'true');
assert.match(headerToggle.textContent, /Réduire/);
clickableHeader.click();
assert.equal(headerCard.classList.contains('vm-expanded'), false);
const enterKey = new window.Event('keydown', { bubbles: true, cancelable: true });
Object.defineProperty(enterKey, 'key', { value: 'Enter' });
clickableHeader.dispatchEvent(enterKey);
assert.equal(headerCard.classList.contains('vm-expanded'), true, 'Entrée doit ouvrir la publication.');
const nestedControl = document.createElement('button');
nestedControl.textContent = 'Contrôle interne';
clickableHeader.appendChild(nestedControl);
nestedControl.click();
assert.equal(headerCard.classList.contains('vm-expanded'), true, 'Un contrôle interne ne doit pas replier la publication.');

const firstOpenControl = document.querySelector(".vm-decisions [data-vm-target]");
const firstOpenTarget = firstOpenControl.dataset.vmTarget;
firstOpenControl.click();
await wait(250);
assert.equal(document.querySelector(`.post[data-item-id="${firstOpenTarget}"]`).classList.contains("vm-expanded"), true);
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
assert.equal(decisionCards().length, 6, "La page locale suivante doit compléter la file restante.");
assert.match(document.querySelector(".vm-queue-end").textContent, /toutes vos décisions chargées/i);

// Un rôle communications ne reçoit que sa propre tâche matérialisée.
  window.dispatchEvent(new window.CustomEvent("cockpit:session-ready", { detail: { profile: { uid: "valentin", role: "admin" } } }));
  await wait();
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
  const completedAdminCard = document.querySelector('[data-item-id="future-2"]');
  completedAdminCard.dataset.workflowStage = "scheduled";
  completedAdminCard.dataset.workflowUpdatedAt = "300";
  document.querySelector('[data-task-id="admin-task"]').dataset.taskUpdatedAt = "400";
  await wait();
  assert.equal(document.querySelector('.vm-decisions [data-vm-target="future-2"]'), null,
    "Même une ancienne tâche techniquement plus récente ne doit pas ressusciter un événement terminé.");
  completedAdminCard.dataset.workflowStage = "content_review";
  completedAdminCard.dataset.workflowUpdatedAt = "100";
  window.dispatchEvent(new window.CustomEvent("cockpit:session-ready", { detail: { profile: { uid: "annie", role: "director" } } }));
await wait();
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Action réservée aux communications/);

// Une action Firestore personnelle devient prioritaire, reste strictement
// liée au rôle et transporte eventId + mediaId jusqu’au média exact.
const actionSource = document.createElement("section");
actionSource.id = "cockpit-action-item-source";
actionSource.hidden = true;
actionSource.dataset.hasMore = "true";
actionSource.innerHTML = `<article data-action-item-id="media-direction-approval-alt" data-action-assignee-role="director" data-action-target-type="schedule" data-action-target="future-2" data-action-media="media-future-2" data-action-type="approve_text_then_media" data-action-priority="10" data-action-date="2026-07-16" data-action-updated-at="500"><b>Vérifier le visuel recommandé</b><p>Le texte demeure la première porte; le visuel vient ensuite.</p></article>`;
document.body.appendChild(actionSource);
window.dispatchEvent(new window.CustomEvent("cockpit:action-items-updated"));
await wait();
assert.match(document.querySelector(".vm-decisions").textContent, /Vérifier le visuel recommandé/);
completedAdminCard.dataset.workflowStage = "published";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Vérifier le visuel recommandé/,
  "Une action personnelle encore pending dans Firestore doit être élaguée dès que la publication est terminée.");
completedAdminCard.dataset.workflowStage = "content_review";
window.dispatchEvent(new window.CustomEvent("cockpit:data-updated"));
await wait();
const mediaAction = document.querySelector('.vm-decisions [data-vm-target="future-2"][data-vm-media="media-future-2"]');
assert.ok(mediaAction, "L’action personnelle doit transporter la cible média exacte.");
mediaAction.click();
await wait(250);
assert.equal(document.querySelector('[data-item-id="future-2"] details.cockpit-media-info').hasAttribute("open"), true);
window.dispatchEvent(new window.CustomEvent("cockpit:session-ready", { detail: { profile: { uid: "valentin", role: "admin" } } }));
await wait();
assert.doesNotMatch(document.querySelector(".vm-decisions").textContent, /Vérifier le visuel recommandé/);
window.dispatchEvent(new window.CustomEvent("cockpit:session-ready", { detail: { profile: { uid: "annie", role: "director" } } }));
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
assert.equal(document.querySelector("#search").value, "");
assert.equal(document.querySelector("#week").value, "all");
assert.equal(document.querySelector("#theme").value, "all");
assert.equal(document.querySelector("#past-toggle").dataset.active, "true");
assert.equal(pastCard.classList.contains("vm-expanded"), true);
assert.equal(pastCard.querySelector(":scope > details").hasAttribute("open"), true);
assert.equal(pastCard.querySelector("details.cockpit-media").hasAttribute("open"), true);
assert.equal(pastCard.dataset.testFocused, "true");
assert.match(document.querySelector("#cockpit-announcer").textContent, /Élément ouvert : Publication passée/i);

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
assert.equal(document.querySelectorAll("#cockpit-essential-dashboard").length, 1);

viewMode.destroy();
console.log("✓ Navigation P0 et file personnelle : tests DOM réussis.");
