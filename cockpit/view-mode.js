/**
 * Vue essentielle / Vue complète du Cockpit Communication Bleu Massawippi.
 *
 * Ce module ne possède aucune donnée métier et n'écrit jamais dans Firestore.
 * Il résume le DOM déjà rendu par cockpit-ui.js, puis renvoie toujours vers les
 * contrôles d'origine. Une panne de ce module laisse donc le cockpit complet
 * intact.
 */

const MODULE_ID = "cockpit-view-mode";
const STORAGE_PREFIX = "bleu-massawippi-view-mode";
const VALID_MODES = new Set(["essential", "complete"]);
const MONTHS = new Map([
  ["janvier", 0], ["février", 1], ["fevrier", 1], ["mars", 2],
  ["avril", 3], ["mai", 4], ["juin", 5], ["juillet", 6],
  ["août", 7], ["aout", 7], ["septembre", 8], ["octobre", 9],
  ["novembre", 10], ["décembre", 11], ["decembre", 11]
]);

const runtime = {
  initialized: false,
  mode: "complete",
  identity: { uid: "", role: "" },
  explicitMode: false,
  options: {},
  observer: null,
  renderTimer: 0,
  listeners: [],
  focusedCard: null,
  focusTimer: 0
};

const icon = (name) => {
  const symbol = { decision: "actions", week: "calendar" }[name] || name;
  const sprite = new URL(`./icons.svg#${symbol}`, import.meta.url).href;
  return `<svg class="vm-icon" aria-hidden="true" focusable="false"><use href="${sprite}"></use></svg>`;
};

function listen(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  runtime.listeners.push(() => target.removeEventListener(type, handler, options));
}

function normaliseRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (["director", "direction", "dg"].includes(role)) return "director";
  if (["admin", "administrator", "communications"].includes(role)) return "admin";
  return "";
}

function detectIdentity(detail = null) {
  let supplied = detail?.profile || detail || null;
  if (typeof runtime.options.getIdentity === "function") {
    try { supplied = runtime.options.getIdentity() || supplied; } catch { /* repli DOM */ }
  }
  supplied = supplied || runtime.options.profile || {};

  const session = document.querySelector("#cockpit-session");
  const sessionText = session?.textContent || "";
  const roleFromDom = document.body.classList.contains("cockpit-admin") || /rôle\s+admin/i.test(sessionText)
    ? "admin"
    : /rôle\s+director|direction générale/i.test(sessionText) ? "director" : "";

  return {
    uid: String(supplied.uid || runtime.options.uid || session?.dataset?.uid || "").trim(),
    role: normaliseRole(supplied.role || runtime.options.role || roleFromDom)
  };
}

function storageKeys(identity = runtime.identity) {
  if (identity.uid) return [`${STORAGE_PREFIX}:uid:${identity.uid}`];
  if (identity.role) return [`${STORAGE_PREFIX}:role:${identity.role}`];
  return [`${STORAGE_PREFIX}:device`];
}

function readPreference(identity) {
  try {
    for (const key of storageKeys(identity)) {
      const value = localStorage.getItem(key);
      if (VALID_MODES.has(value)) return value;
    }
  } catch { /* stockage indisponible : préférence limitée à la session */ }
  return "";
}

function writePreference(mode) {
  try {
    storageKeys(runtime.identity).forEach((key) => localStorage.setItem(key, mode));
  } catch { /* le mode actif reste utilisable pour la session */ }
}

function defaultMode(identity) {
  if (identity.role === "director") return "essential";
  return "complete";
}

function ensureStylesheet() {
  if (document.querySelector(`link[data-module="${MODULE_ID}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./view-mode.css", import.meta.url).href;
  link.dataset.module = MODULE_ID;
  document.head.appendChild(link);
}

function ensureToggle() {
  const session = document.querySelector("#cockpit-session");
  if (!session) return null;
  let group = session.querySelector("#cockpit-view-mode-toggle");
  if (group) return group;

  group = document.createElement("div");
  group.id = "cockpit-view-mode-toggle";
  group.className = "vm-toggle";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Niveau de détail de l’interface");
  group.innerHTML = `
    <button type="button" data-view-mode="essential" aria-pressed="false">${icon("essential")}<span>Vue essentielle</span></button>
    <button type="button" data-view-mode="complete" aria-pressed="false">${icon("complete")}<span>Vue complète</span></button>`;
  const logout = session.querySelector("#cockpit-logout");
  session.insertBefore(group, logout || null);
  return group;
}

function ensureDashboard() {
  const host = document.querySelector("#cockpit-content");
  if (!host || !host.children.length) return null;
  let dashboard = host.querySelector("#cockpit-essential-dashboard");
  if (dashboard) return dashboard;

  dashboard = document.createElement("section");
  dashboard.id = "cockpit-essential-dashboard";
  dashboard.className = "vm-dashboard wrap";
  dashboard.setAttribute("aria-labelledby", "vm-dashboard-title");
  dashboard.innerHTML = `
    <header class="vm-dashboard-head">
      <div><p class="vm-eyebrow">Tableau de bord</p><h1 id="vm-dashboard-title">Ce qui demande votre attention</h1></div>
      <button type="button" class="vm-show-complete" data-view-mode="complete">Afficher tous les détails</button>
    </header>
    <div class="vm-dashboard-grid" data-vm-dashboard-grid></div>`;

  const hero = host.querySelector(".hero");
  if (hero) hero.before(dashboard);
  else host.prepend(dashboard);
  return dashboard;
}

function ensureEssentialNav() {
  const wrap = document.querySelector(".nav .wrap");
  if (!wrap) return null;
  if (!wrap.querySelector('[data-vm-nav="today"]')) {
    const today = document.createElement("a");
    today.href = "#vm-panel-today";
    today.dataset.vmNav = "today";
    today.innerHTML = `${icon("today")}<span>Aujourd’hui</span>`;
    wrap.prepend(today);
  }
  if (!wrap.querySelector('[data-vm-nav="messages"]')) {
    const messages = document.createElement("a");
    messages.href = "#vm-panel-message";
    messages.dataset.vmNav = "messages";
    messages.innerHTML = `${icon("message")}<span>Messages</span><b data-vm-message-count hidden>0</b>`;
    wrap.append(messages);
  }
  return wrap;
}

function modeLabel(mode) {
  return mode === "essential" ? "Vue essentielle" : "Vue complète";
}

function applyMode(mode, { persist = false } = {}) {
  runtime.mode = VALID_MODES.has(mode) ? mode : "complete";
  document.documentElement.dataset.cockpitView = runtime.mode;
  document.body.classList.toggle("cockpit-view-essential", runtime.mode === "essential");
  document.body.classList.toggle("cockpit-view-complete", runtime.mode === "complete");

  document.querySelectorAll("[data-view-mode]").forEach((button) => {
    const active = button.dataset.viewMode === runtime.mode;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  });
  const toggle = document.querySelector("#cockpit-view-mode-toggle");
  if (toggle) toggle.setAttribute("aria-label", `Niveau de détail de l’interface. ${modeLabel(runtime.mode)} active.`);
  if (persist) writePreference(runtime.mode);
  if (persist) {
    const announcer = document.querySelector("#cockpit-announcer");
    if (announcer) announcer.textContent = `${modeLabel(runtime.mode)} activée.`;
  }
}

function stripAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function inferDate(value, now = new Date()) {
  const plain = stripAccents(value);
  const iso = plain.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    const date = new Date(year, month, day, 12);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  }
  const match = plain.match(/\b(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?/i);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS.get(match[2]);
  if (!Number.isInteger(day) || month === undefined) return null;
  if (match[3]) return new Date(Number(match[3]), month, day, 12);

  const candidates = [-1, 0, 1].map((offset) => new Date(now.getFullYear() + offset, month, day, 12));
  return candidates.sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];
}

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function planItems() {
  return Array.isArray(globalThis.posts) ? globalThis.posts : [];
}

function cardForId(id) {
  return [...document.querySelectorAll(".post[data-item-id]")].find((card) => card.dataset.itemId === id) || null;
}

function eventModels(now = new Date()) {
  const planById = new Map(planItems().map((item) => [String(item.id), item]));
  return [...document.querySelectorAll(".post[data-item-id]")].map((card) => {
    const id = String(card.dataset.itemId || "");
    const item = planById.get(id) || {};
    const title = item.title || card.querySelector(".post-head h4")?.textContent?.trim() || "Publication";
    const dateLabel = item.date || card.querySelector(".date")?.textContent?.split("·")[0]?.trim() || "Date à confirmer";
    const date = inferDate(item.dateIso || item.date || dateLabel, now);
    const action = card.querySelector("[data-workflow-actions] button.primary:not(:disabled), [data-workflow-actions] button.correction:not(:disabled), [data-workflow-actions] button:not(:disabled)");
    const currentGate = card.querySelector("[data-gate].current");
    const currentGateName = currentGate?.querySelector("b")?.textContent?.replace(/^\d+\s*·\s*/, "")?.trim() || "";
    const currentGateLabel = currentGate?.querySelector("[data-gate-label]")?.textContent?.trim() || "";
    const complete = Boolean(card.querySelector('[data-gate="publication"][aria-pressed="true"], [data-gate="publication"].done'));
    const undecided = Boolean(card.querySelector('[data-editorial-controls] [data-editorial-decision="undecided"].active'));
    const setAside = card.classList.contains("editorial-deferred") || card.classList.contains("editorial-rejected") || card.classList.contains("is-deleted");
    return {
      id, card, item, title, date, dateLabel, complete,
      action: action?.textContent?.trim() || (complete ? "Terminé" : currentGateName ? `${currentGateName} — ${currentGateLabel}` : "Ouvrir l’événement"),
      needsDecision: !complete && !setAside && (Boolean(action) || undecided),
      theme: item.t || card.dataset.t || "Publication"
    };
  }).filter((model) => model.id);
}

function relativeDateLabel(date, now) {
  if (!date) return "Date à confirmer";
  const distance = Math.round((dayStart(date) - dayStart(now)) / 86400000);
  if (distance === 0) return "Aujourd’hui";
  if (distance === 1) return "Demain";
  return new Intl.DateTimeFormat("fr-CA", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function linkButton(event, label = "Ouvrir") {
  return `<button type="button" class="vm-open" data-vm-target="${escapeHtml(event.id)}">${escapeHtml(label)}<span aria-hidden="true">→</span></button>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function panel(name, title, count, body, modifier = "") {
  return `<article id="vm-panel-${escapeHtml(name)}" class="vm-panel ${modifier}">
    <header>${icon(name)}<div><h2>${escapeHtml(title)}</h2><span>${count}</span></div></header>
    <div class="vm-panel-body">${body}</div>
  </article>`;
}

function empty(message) {
  return `<p class="vm-empty">${escapeHtml(message)}</p>`;
}

function compactEvent(event, now, { showAction = true } = {}) {
  return `<article class="vm-event">
    <div><span class="vm-event-date">${escapeHtml(relativeDateLabel(event.date, now))}</span><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.theme)}${showAction ? ` · ${escapeHtml(event.action)}` : ""}</p></div>
    ${linkButton(event)}
  </article>`;
}

function gateIsDone(card, gate) {
  return Boolean(card.querySelector(`[data-gate="${gate}"][aria-pressed="true"], [data-gate="${gate}"].done`));
}

function enhanceCardSummaries() {
  document.querySelectorAll(".post[data-item-id]").forEach((card) => {
    const head = card.querySelector(":scope > .post-head");
    if (!head) return;
    let summary = card.querySelector(":scope > .vm-card-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "vm-card-summary";
      head.after(summary);
    }

    const action = card.querySelector("[data-workflow-actions] button:not(:disabled)")?.textContent?.trim()
      || (card.classList.contains("workflow-complete") ? "Publication terminée" : "Ouvrir pour poursuivre");
    const state = {
      content: gateIsDone(card, "content"),
      media: gateIsDone(card, "media"),
      publication: gateIsDone(card, "publication")
    };
    const expanded = card.classList.contains("vm-expanded");
    const signature = JSON.stringify({ action, state, expanded });
    if (summary.dataset.signature === signature) return;
    summary.dataset.signature = signature;
    const step = (label, done) => `<span class="${done ? "done" : ""}"><i aria-hidden="true">${done ? "✓" : "○"}</i>${label}</span>`;
    summary.innerHTML = `
      <div class="vm-card-next"><small>Prochaine étape</small><b>${escapeHtml(action)}</b></div>
      <div class="vm-card-progress" aria-label="Texte ${state.content ? "approuvé" : "à valider"}; média ${state.media ? "approuvé" : "à valider"}; publication ${state.publication ? "terminée" : "à faire"}">
        ${step("Texte", state.content)}${step("Média", state.media)}${step("Publication", state.publication)}
      </div>
      <button type="button" data-vm-card-toggle aria-expanded="${expanded}">${expanded ? "Réduire" : "Voir et décider"}</button>`;
  });
}

function messageModels() {
  const events = new Map(eventModels().map((model) => [model.id, model]));
  return [...document.querySelectorAll(".post[data-item-id] [data-comment-thread] .cockpit-message:not(.handled)")]
    .map((message, index) => {
      const card = message.closest(".post[data-item-id]");
      const event = card ? events.get(card.dataset.itemId) : null;
      return {
        id: message.dataset.commentId || String(index),
        event,
        author: message.querySelector("header b")?.textContent?.replace(/^💬\s*/, "")?.trim() || "Message",
        when: message.querySelector("header span")?.textContent?.trim() || "",
        text: message.querySelector("p")?.textContent?.trim() || "",
        createdAt: Number(message.dataset.createdAt || 0)
      };
    }).filter((message) => message.event && message.text)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 5);
}

function renderDashboard(now = new Date()) {
  const dashboard = ensureDashboard();
  const grid = dashboard?.querySelector("[data-vm-dashboard-grid]");
  if (!grid) return;

  const start = dayStart(now);
  const events = eventModels(now).sort((a, b) => (a.date || Infinity) - (b.date || Infinity));
  const today = events.filter((event) => event.date && dayStart(event.date).getTime() === start.getTime());
  const nextWeek = events.filter((event) => {
    if (!event.date) return false;
    const distance = (dayStart(event.date) - start) / 86400000;
    return distance > 0 && distance <= 7;
  });
  const decisions = events.filter((event) => event.needsDecision && (!event.date || dayStart(event.date) >= start)).slice(0, 7);
  const messages = messageModels();

  const todayBody = today.length
    ? today.map((event) => compactEvent(event, now)).join("")
    : empty("Aucune publication prévue aujourd’hui.");
  const decisionsBody = decisions.length
    ? decisions.map((event) => compactEvent(event, now)).join("")
    : `<div class="vm-all-clear"><b>Tout est à jour.</b><span>Aucune décision n’est requise pour le moment.</span></div>`;
  const weekBody = nextWeek.length
    ? nextWeek.map((event) => compactEvent(event, now, { showAction: false })).join("")
    : empty("Aucun événement au cours des sept prochains jours.");
  const messagesBody = messages.length
    ? messages.map((message) => `<article class="vm-message"><div><span>${escapeHtml(message.author)}${message.when ? ` · ${escapeHtml(message.when)}` : ""}</span><h3>${escapeHtml(message.event.title)}</h3><p>${escapeHtml(message.text)}</p></div>${linkButton(message.event, "Répondre")}</article>`).join("")
    : empty("Aucun message actif dans les événements visibles.");

  grid.innerHTML = [
    panel("today", "Aujourd’hui", `${today.length} événement${today.length > 1 ? "s" : ""}`, todayBody, "vm-today"),
    panel("decision", "Décisions qui m’attendent", `${decisions.length} à traiter`, decisionsBody, "vm-decisions"),
    panel("week", "Les sept prochains jours", `${nextWeek.length} événement${nextWeek.length > 1 ? "s" : ""}`, weekBody, "vm-week"),
    panel("message", "Messages actifs", `${messages.length} récent${messages.length > 1 ? "s" : ""}`, messagesBody, "vm-messages")
  ].join("");

  enhanceCardSummaries();
  const messageBadge = ensureEssentialNav()?.querySelector("[data-vm-message-count]");
  if (messageBadge) {
    messageBadge.textContent = String(messages.length);
    messageBadge.hidden = messages.length === 0;
    messageBadge.setAttribute("aria-label", `${messages.length} message${messages.length > 1 ? "s" : ""} actif${messages.length > 1 ? "s" : ""}`);
  }
}

function openEvent(id) {
  const card = cardForId(id);
  if (!card) return;
  const calendar = document.querySelector("#calendrier");
  if (calendar?.hidden) calendar.hidden = false;
  if (runtime.mode === "essential") {
    card.classList.add("vm-expanded");
    const toggle = card.querySelector(":scope > .vm-card-summary [data-vm-card-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
      toggle.textContent = "Réduire";
    }
  } else {
    card.querySelector(":scope > details")?.setAttribute("open", "");
  }
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  card.classList.add("vm-focus");
  runtime.focusedCard?.classList.remove("vm-focus");
  runtime.focusedCard = card;
  clearTimeout(runtime.focusTimer);
  runtime.focusTimer = setTimeout(() => {
    card.classList.remove("vm-focus");
    if (runtime.focusedCard === card) runtime.focusedCard = null;
  }, 2200);
}

function scheduleRender() {
  clearTimeout(runtime.renderTimer);
  runtime.renderTimer = setTimeout(() => renderDashboard(), 80);
}

function observeDataDom() {
  runtime.observer?.disconnect();
  const targets = [document.querySelector("#posts"), document.querySelector("#cockpit-sidebar")].filter(Boolean);
  if (!targets.length) return;
  runtime.observer = new MutationObserver(scheduleRender);
  targets.forEach((target) => runtime.observer.observe(target, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["class", "aria-pressed", "hidden", "data-status"]
  }));
}

function refreshIdentity(detail = null) {
  const next = detectIdentity(detail);
  const changed = next.uid !== runtime.identity.uid || next.role !== runtime.identity.role;
  runtime.identity = next;
  if (changed && !runtime.explicitMode) {
    applyMode(readPreference(next) || defaultMode(next));
  }
}

function handleClick(event) {
  const modeButton = event.target.closest("[data-view-mode]");
  if (modeButton && VALID_MODES.has(modeButton.dataset.viewMode)) {
    runtime.explicitMode = true;
    applyMode(modeButton.dataset.viewMode, { persist: true });
    if (runtime.mode === "essential") renderDashboard();
    return;
  }
  const cardToggle = event.target.closest("[data-vm-card-toggle]");
  if (cardToggle) {
    const card = cardToggle.closest(".post[data-item-id]");
    if (!card) return;
    const expanded = !card.classList.contains("vm-expanded");
    card.classList.toggle("vm-expanded", expanded);
    cardToggle.setAttribute("aria-expanded", String(expanded));
    cardToggle.textContent = expanded ? "Réduire" : "Voir et décider";
    card.querySelector(":scope > .vm-card-summary")?.removeAttribute("data-signature");
    return;
  }
  const target = event.target.closest("[data-vm-target]");
  if (target) openEvent(target.dataset.vmTarget);
}

/** Initialise le module. L'appel est idempotent. */
export function init(options = {}) {
  runtime.options = { ...runtime.options, ...options };
  if (runtime.initialized) {
    update(options);
    return;
  }
  runtime.initialized = true;
  ensureStylesheet();
  runtime.identity = detectIdentity(options.profile || options);
  const requested = VALID_MODES.has(options.mode) ? options.mode : "";
  runtime.mode = requested || readPreference(runtime.identity) || defaultMode(runtime.identity);
  runtime.explicitMode = Boolean(requested);

  listen(document, "click", handleClick);
  listen(window, "cockpit:content-ready", () => update());
  listen(window, "cockpit:session-ready", (event) => update(event.detail || {}));
  listen(window, "cockpit:session-ended", () => {
    runtime.identity = { uid: "", role: "" };
    runtime.explicitMode = false;
    document.querySelector("#cockpit-view-mode-toggle")?.remove();
    document.querySelector("#cockpit-essential-dashboard")?.remove();
    document.querySelectorAll("[data-vm-nav]").forEach((node) => node.remove());
  });
  listen(window, "cockpit:data-updated", () => update());
  listen(window, "pageshow", () => update());

  update();
}

/** Recalcule l'identité, le sélecteur et le tableau de bord à partir du DOM. */
export function update(options = {}) {
  runtime.options = { ...runtime.options, ...options };
  if (!runtime.initialized) return init(options);
  refreshIdentity(options.profile || options);
  ensureToggle();
  ensureDashboard();
  ensureEssentialNav();
  applyMode(runtime.mode);
  renderDashboard(options.now instanceof Date ? options.now : new Date());
  observeDataDom();
}

/** Retire uniquement les éléments et écouteurs appartenant à ce module. */
export function destroy() {
  clearTimeout(runtime.renderTimer);
  clearTimeout(runtime.focusTimer);
  runtime.observer?.disconnect();
  runtime.listeners.splice(0).forEach((remove) => remove());
  document.querySelector("#cockpit-view-mode-toggle")?.remove();
  document.querySelector("#cockpit-essential-dashboard")?.remove();
  document.querySelectorAll("[data-vm-nav]").forEach((node) => node.remove());
  document.querySelectorAll(".vm-card-summary").forEach((node) => node.remove());
  document.querySelector(`link[data-module="${MODULE_ID}"]`)?.remove();
  document.documentElement.removeAttribute("data-cockpit-view");
  document.body.classList.remove("cockpit-view-essential", "cockpit-view-complete");
  runtime.initialized = false;
  runtime.explicitMode = false;
  runtime.observer = null;
  runtime.focusedCard = null;
}

// Autonome lorsque chargé directement; init() reste exporté pour les tests et
// les intégrations qui souhaitent fournir explicitement l'uid et le rôle.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init(), { once: true });
} else {
  init();
}
