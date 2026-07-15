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
const QUEUE_PAGE_SIZE = Object.freeze({ director: 5, admin: 7 });
const NAVIGATION_ATTEMPTS = 5;
const NAVIGATION_DELAY_MS = 60;
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
  focusTimer: 0,
  navigationToken: 0,
  queueRole: "",
  queueVisibleCount: 0
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
    <div class="vm-dashboard-grid" data-vm-dashboard-grid></div>
    <div class="vm-navigation-status" data-vm-navigation-status role="alert" hidden></div>`;

  const hero = host.querySelector(".hero");
  if (hero) hero.before(dashboard);
  else host.prepend(dashboard);
  return dashboard;
}

function ensureEssentialNav() {
  const wrap = document.querySelector(".nav .wrap");
  if (!wrap) return null;
  let decisions = wrap.querySelector('[data-vm-nav="decision"]');
  if (!decisions) {
    decisions = document.createElement("a");
    decisions.href = "#vm-panel-decision";
    decisions.dataset.vmNav = "decision";
    decisions.innerHTML = `${icon("decision")}<span>Décisions</span>`;
  }
  let today = wrap.querySelector('[data-vm-nav="today"]');
  if (!today) {
    today = document.createElement("a");
    today.href = "#vm-panel-today";
    today.dataset.vmNav = "today";
    today.innerHTML = `${icon("today")}<span>Aujourd’hui</span>`;
  }
  // L'ordre du sommaire reflète l'ordre d'action du tableau de bord.
  wrap.prepend(today);
  wrap.prepend(decisions);
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

function planItemForId(id) {
  return planItems().find((candidate) => String(candidate.id) === String(id)) || null;
}

function queuePageSize(role = runtime.identity.role) {
  return QUEUE_PAGE_SIZE[role] || QUEUE_PAGE_SIZE.director;
}

function announce(message) {
  const announcer = document.querySelector("#cockpit-announcer");
  if (announcer) announcer.textContent = message;
}

function navigationStatus() {
  return ensureDashboard()?.querySelector("[data-vm-navigation-status]") || null;
}

function clearNavigationError() {
  const status = navigationStatus();
  if (!status) return;
  status.hidden = true;
  status.replaceChildren();
}

function reportNavigationError({ type = "schedule", id = "" } = {}, detail = "") {
  const status = navigationStatus();
  const label = detail || "La cible n’est pas encore disponible dans cette vue.";
  if (status) {
    status.hidden = false;
    status.innerHTML = `<span><b>Impossible d’ouvrir cet élément.</b> ${escapeHtml(label)}</span>
      <button type="button" data-vm-retry-type="${escapeHtml(type)}" data-vm-retry-id="${escapeHtml(id)}">Réessayer</button>`;
  }
  announce(`Impossible d’ouvrir cet élément. ${label} Vous pouvez réessayer.`);
}

function normaliseTargetType(type) {
  const value = String(type || "schedule").trim().toLowerCase().replaceAll("-", "_");
  if (["schedule", "event", "post", "publication"].includes(value)) return "schedule";
  if (["project", "internal_project", "internalproject"].includes(value)) return "project";
  if (["opportunity", "occasion"].includes(value)) return "opportunity";
  if (value === "task") return "task";
  return "section";
}

function targetWithDataset(name, id) {
  return [...document.querySelectorAll(`[${name}]`)].find((node) => node.getAttribute(name) === id) || null;
}

function findEntityTarget(type, id) {
  const targetType = normaliseTargetType(type);
  const targetId = String(id || "").trim();
  if (!targetId) return null;
  if (targetType === "schedule") return cardForId(targetId);
  if (targetType === "project") {
    return targetWithDataset("data-internal-project-id", targetId)
      || document.getElementById(targetId)
      || document.getElementById(`internal-project-${targetId}`)
      || targetWithDataset("data-id", targetId);
  }
  if (targetType === "opportunity") {
    return targetWithDataset("data-opportunity-id", targetId)
      || document.getElementById(targetId)
      || document.getElementById(`opportunity-${targetId}`)
      || targetWithDataset("data-id", targetId);
  }
  return document.getElementById(targetId)
    || targetWithDataset("data-id", targetId)
    || targetWithDataset("data-item-id", targetId);
}

function dispatchFilterRender(search, week, theme) {
  // Le moteur du calendrier relit les trois valeurs à chaque rendu. Un seul
  // événement suffit donc et évite trois reconstructions successives du DOM.
  if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
  else if (week) week.dispatchEvent(new Event("change", { bubbles: true }));
  else theme?.dispatchEvent(new Event("change", { bubbles: true }));
}

function clearCalendarFilters() {
  const search = document.querySelector("#search");
  const week = document.querySelector("#week");
  const theme = document.querySelector("#theme");
  if (search) search.value = "";
  if (week) week.value = "all";
  if (theme) theme.value = "all";
  dispatchFilterRender(search, week, theme);
}

function prepareCalendarTarget(id) {
  clearCalendarFilters();
  const calendar = document.querySelector("#calendrier");
  if (calendar?.hidden) calendar.hidden = false;
  const item = planItemForId(id);
  const eventDate = inferDate(item?.dateIso || item?.date || "");
  if (eventDate && dayStart(eventDate) < dayStart(new Date())) {
    const pastToggle = document.querySelector("#past-toggle");
    if (pastToggle?.dataset.active !== "true") pastToggle.click();
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForEntityTarget(type, id, navigationToken) {
  for (let attempt = 0; attempt < NAVIGATION_ATTEMPTS; attempt += 1) {
    if (navigationToken !== runtime.navigationToken) return null;
    const target = findEntityTarget(type, id);
    if (target) return target;
    await delay(NAVIGATION_DELAY_MS * (attempt + 1));
  }
  return null;
}

function shouldUseCompleteView(target, type) {
  if (runtime.mode !== "essential") return false;
  if (normaliseTargetType(type) !== "section") return false;
  const section = target.matches?.("section, details") ? target : target.closest?.("section, details");
  return Boolean(section && !["calendrier", "projets", "cockpit-essential-dashboard"].includes(section.id));
}

function revealTargetTree(target) {
  let ancestor = target;
  while (ancestor && ancestor !== document.documentElement) {
    if (ancestor.hidden) ancestor.hidden = false;
    if (ancestor.getAttribute?.("aria-hidden") === "true") ancestor.removeAttribute("aria-hidden");
    if (ancestor.matches?.("details")) ancestor.setAttribute("open", "");
    ancestor = ancestor.parentElement;
  }
  const card = target.matches?.(".post[data-item-id]") ? target : target.closest?.(".post[data-item-id]");
  if (!card) {
    target.querySelector?.(":scope > details")?.setAttribute("open", "");
    return null;
  }
  card.hidden = false;
  card.classList.add("vm-navigation-reveal");
  setCardExpanded(card, true);
  card.querySelector(":scope > details")?.setAttribute("open", "");
  card.querySelector("details.cockpit-media")?.setAttribute("open", "");
  return card;
}

function targetLabel(target, fallback) {
  return target.querySelector?.(".post-head h4, h2, h3, summary, b")?.textContent?.trim()
    || target.getAttribute?.("aria-label")
    || fallback
    || "Élément";
}

function focusAndHighlight(target, card = null) {
  const focusTarget = card || target;
  runtime.focusedCard?.classList.remove("vm-focus", "vm-target-focus");
  runtime.focusedCard = focusTarget;
  focusTarget.classList.add(card ? "vm-focus" : "vm-target-focus");
  if (!focusTarget.hasAttribute("tabindex")) {
    focusTarget.setAttribute("tabindex", "-1");
    focusTarget.dataset.vmTemporaryTabindex = "true";
  }
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  focusTarget.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  try { focusTarget.focus({ preventScroll: true }); } catch { focusTarget.focus?.(); }
  clearTimeout(runtime.focusTimer);
  runtime.focusTimer = setTimeout(() => {
    focusTarget.classList.remove("vm-focus", "vm-target-focus");
    if (runtime.focusedCard === focusTarget) runtime.focusedCard = null;
  }, 2200);
}

/**
 * Ouvre une entité déjà autorisée par la session, sans lecture Firestore.
 * La recherche est bornée afin de laisser le calendrier se rerendre après la
 * levée de ses filtres. Un échec reste visible et peut être réessayé.
 */
export async function navigateToEntity({ type = "schedule", id = "", mediaId = "" } = {}) {
  const targetType = normaliseTargetType(type);
  const targetId = String(id || "").trim();
  if (!targetId) {
    reportNavigationError({ type: targetType, id: targetId }, "La cible ne possède pas d’identifiant.");
    return false;
  }

  if (targetType === "task") {
    const task = [...document.querySelectorAll("#cockpit-task-list .cockpit-task-item[data-task-id]")]
      .find((candidate) => candidate.dataset.taskId === targetId);
    const openButton = task?.querySelector("[data-open-task]");
    if (!openButton) {
      reportNavigationError({ type: targetType, id: targetId }, "Cette décision a changé ou n’est plus chargée.");
      return false;
    }
    return navigateToEntity({
      type: openButton.dataset.taskTargetType || task.dataset.taskTargetType || "schedule",
      id: openButton.dataset.taskTarget || task.dataset.taskTarget || ""
    });
  }

  const navigationToken = ++runtime.navigationToken;
  clearNavigationError();
  if (targetType === "schedule") prepareCalendarTarget(targetId);
  let target = await waitForEntityTarget(targetType, targetId, navigationToken);
  if (!target) {
    reportNavigationError(
      { type: targetType, id: targetId },
      planItemForId(targetId)?.archivedEditorial === true
        ? "Cette ancienne proposition est conservée dans les archives et n’est pas chargée dans le calendrier courant."
        : "La cible n’a pas pu être chargée. Vérifiez la connexion, puis réessayez."
    );
    return false;
  }
  if (navigationToken !== runtime.navigationToken) return false;

  if (shouldUseCompleteView(target, targetType)) {
    applyMode("complete");
    await delay(0);
    target = findEntityTarget(targetType, targetId) || target;
  }
  const card = revealTargetTree(target);
  let focusTarget = card || target;
  if (card && mediaId) {
    const media = [...card.querySelectorAll(".cockpit-media-card[data-media-id]")]
      .find((candidate) => candidate.dataset.mediaId === mediaId);
    if (media) {
      media.querySelector("details.cockpit-media-info")?.setAttribute("open", "");
      focusTarget = media;
    }
  }
  focusAndHighlight(focusTarget, focusTarget === card ? card : null);
  const label = targetLabel(card || target, targetId);
  announce(`Élément ouvert : ${label}. Le brief et les médias sont prêts à être consultés.`);
  clearNavigationError();
  return true;
}

function dataMillis(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function inferredWorkflowStage(card) {
  if (card.dataset.workflowStage) return card.dataset.workflowStage;
  if (gateIsDone(card, "publication")) return "published";
  if (gateIsDone(card, "media")) return "final_approved";
  if (gateIsDone(card, "content")) {
    const mediaLabel = card.querySelector('[data-gate="media"] [data-gate-label]')?.textContent || "";
    return /prêt pour validation/i.test(mediaLabel) ? "media_review" : "content_approved";
  }
  const contentLabel = card.querySelector('[data-gate="content"] [data-gate-label]')?.textContent || "";
  if (/correction/i.test(contentLabel)) return "changes_requested";
  if (/prêt pour validation/i.test(contentLabel)) return "content_review";
  return "proposal";
}

function incomingMessageFor(card) {
  return [...card.querySelectorAll('[data-comment-thread] .cockpit-message.other:not(.handled)')]
    .map((message) => ({
      text: message.querySelector("p")?.textContent?.trim() || "",
      updatedAt: dataMillis(message.dataset.createdAt)
    }))
    .filter((message) => message.text)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
}

function mediaStateFor(card) {
  const proposals = [...card.querySelectorAll(".cockpit-media-card")].filter((media) => {
    const stage = media.dataset.mediaStage || "";
    return !["source", "reference"].includes(stage);
  });
  return {
    count: proposals.length,
    selectedCount: proposals.filter((media) => media.classList.contains("is-final") || media.dataset.mediaSelectedFinal === "true").length,
    communicationsSelected: proposals.some((media) => media.dataset.mediaCommunicationsSelected === "true"),
    directionSelected: proposals.some((media) => media.dataset.mediaDirectionSelected === "true"),
    latestUpdate: proposals.reduce((latest, media) => Math.max(latest, dataMillis(media.dataset.mediaUpdatedAt)), 0)
  };
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
    const stage = inferredWorkflowStage(card);
    const complete = ["scheduled", "published"].includes(stage)
      || Boolean(card.querySelector('[data-gate="publication"][aria-pressed="true"], [data-gate="publication"].done'));
    const undecided = Boolean(card.querySelector('[data-editorial-controls] [data-editorial-decision="undecided"].active'));
    const setAside = card.classList.contains("editorial-deferred") || card.classList.contains("editorial-rejected") || card.classList.contains("is-deleted");
    const media = mediaStateFor(card);
    const incomingMessage = incomingMessageFor(card);
    return {
      id, card, item, title, date, dateLabel, complete,
      action: action?.textContent?.trim() || (complete ? "Terminé" : currentGateName ? `${currentGateName} — ${currentGateLabel}` : "Ouvrir l’événement"),
      undecided, setAside, incomingMessage, media,
      stage,
      workflowUpdatedAt: dataMillis(card.dataset.workflowUpdatedAt),
      editorialUpdatedAt: dataMillis(card.dataset.editorialUpdatedAt),
      theme: item.t || card.dataset.t || "Publication"
    };
  }).filter((model) => model.id);
}

function relativeDateLabel(date, now) {
  if (!date) return "Date à confirmer";
  const distance = Math.round((dayStart(date) - dayStart(now)) / 86400000);
  if (distance === 0) return "Aujourd’hui";
  if (distance === 1) return "Demain";
  const formatted = new Intl.DateTimeFormat("fr-CA", { weekday: "short", day: "numeric", month: "short" }).format(date);
  return distance < 0 ? `En retard · ${formatted}` : formatted;
}

function pendingTaskModels(role = runtime.identity.role) {
  return [...document.querySelectorAll("#cockpit-task-list .cockpit-task-item[data-task-id]")].map((task) => ({
    id: task.dataset.taskId || "",
    assigneeRole: normaliseRole(task.dataset.taskAssigneeRole || ""),
    targetType: task.dataset.taskTargetType || task.querySelector("[data-open-task]")?.dataset.taskTargetType || "schedule",
    targetId: task.dataset.taskTarget || task.querySelector("[data-open-task]")?.dataset.taskTarget || "",
    title: task.querySelector(":scope > b")?.textContent?.trim() || "Tâche à accomplir",
    message: task.querySelector(":scope > p")?.textContent?.trim() || "",
    updatedAt: dataMillis(task.dataset.taskUpdatedAt),
    isComment: task.classList.contains("comment-task")
  })).filter((task) => task.id && task.targetId && (!task.assigneeRole || task.assigneeRole === role));
}

function personalActionItemModels(role = runtime.identity.role) {
  const source = document.querySelector("#cockpit-action-item-source");
  return [...(source?.querySelectorAll("[data-action-item-id]") || [])].map((item) => ({
    id: item.dataset.actionItemId || "",
    assigneeRole: normaliseRole(item.dataset.actionAssigneeRole || ""),
    targetType: item.dataset.actionTargetType || "schedule",
    targetId: item.dataset.actionTarget || "",
    mediaId: item.dataset.actionMedia || "",
    actionType: item.dataset.actionType || "",
    title: item.querySelector(":scope > b")?.textContent?.trim() || "Décision à prendre",
    message: item.querySelector(":scope > p")?.textContent?.trim() || "Action personnelle en attente.",
    priorityKey: Number(item.dataset.actionPriority || 9999),
    eventDateIso: item.dataset.actionDate || "9999-12-31",
    updatedAt: dataMillis(item.dataset.actionUpdatedAt)
  })).filter((item) => item.id && item.targetId && item.assigneeRole === role);
}

function roleDecisionForEvent(event, role, tasks = []) {
  const latestTask = [...tasks].sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
  const baseUpdatedAt = Math.max(event.workflowUpdatedAt, event.editorialUpdatedAt, event.media.latestUpdate, event.incomingMessage?.updatedAt || 0);
  const hasPostClosureTask = event.complete && latestTask && latestTask.updatedAt > event.workflowUpdatedAt;
  const mediaUpdatedAfterWorkflow = event.media.latestUpdate > event.workflowUpdatedAt;

  // Les tâches Firestore sont créées par la direction et destinées aux
  // communications. Elles ne sont jamais montrées à la direction comme si
  // elles lui appartenaient. Une consigne créée après la clôture reste visible;
  // une ancienne tâche ne peut pas ressusciter un événement déjà terminé.
  if (role === "admin" && latestTask && (!event.complete || hasPostClosureTask)) {
    return {
      ...event,
      action: latestTask.title,
      whyNow: latestTask.isComment ? "Nouvelle consigne de la direction" : tasks.length > 1 ? `${tasks.length} actions de la direction à intégrer` : "Décision de la direction à exécuter",
      updatedAt: Math.max(baseUpdatedAt, latestTask.updatedAt)
    };
  }

  if (event.incomingMessage) {
    return {
      ...event,
      action: role === "director" ? "Lire et traiter le message des communications" : "Lire et traiter le message de la direction",
      whyNow: role === "director" ? "Nouveau message des communications" : "Nouveau message de la direction",
      updatedAt: Math.max(baseUpdatedAt, event.incomingMessage.updatedAt)
    };
  }

  if (event.complete || event.setAside) return null;

  if (role === "director") {
    if (event.stage === "content_review") {
      return {
        ...event,
        action: event.undecided ? "Choisir la proposition puis valider son texte" : "Approuver le texte ou demander une correction",
        whyNow: "Texte prêt pour votre validation",
        updatedAt: baseUpdatedAt
      };
    }

    const contentAlreadyApproved = ["content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled"].includes(event.stage);
    // Dès que la direction a fait son choix, son travail disparaît de sa file,
    // même si les communications doivent encore produire, harmoniser ou publier.
    if (contentAlreadyApproved && event.media.directionSelected) return null;
    if (contentAlreadyApproved && event.media.count > 0) {
      return {
        ...event,
        action: event.media.communicationsSelected ? "Confirmer le visuel recommandé" : "Choisir le visuel final et l’approuver",
        whyNow: mediaUpdatedAfterWorkflow ? "Un média vient d’être ajouté ou mis à jour" : "Média prêt pour votre validation",
        updatedAt: Math.max(baseUpdatedAt, event.media.latestUpdate)
      };
    }

    if (event.undecided) {
      return {
        ...event,
        action: "Choisir l’angle éditorial pour cette journée",
        whyNow: "Choix éditorial demandé à la direction",
        updatedAt: baseUpdatedAt
      };
    }
    return null;
  }

  if (role === "admin") {
    const textApproved = ["content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved"].includes(event.stage);
    if (textApproved && event.media.directionSelected) {
      return {
        ...event,
        action: "Publier ou programmer la publication",
        whyNow: "Le texte et le visuel sont validés par la direction",
        updatedAt: baseUpdatedAt
      };
    }
    if (textApproved && event.media.communicationsSelected && !event.media.directionSelected) {
      // Les communications ont remis leur recommandation : la prochaine
      // décision appartient maintenant à la direction.
      return null;
    }
    const adminActions = {
      proposal: ["Finaliser le texte et le soumettre à la direction", "Brouillon à préparer par les communications"],
      changes_requested: ["Appliquer les corrections demandées", "Retour de la direction à intégrer"],
      content_approved: [event.media.count ? "Choisir ou finaliser le média, puis le soumettre" : "Produire ou finaliser le média, puis l’envoyer", "Texte approuvé : le média devient prioritaire"],
      media_in_progress: ["Finaliser le média et le soumettre à la direction", "Production média en cours"],
      media_review: ["Recommander le visuel prêt à valider", "Le média peut maintenant être soumis à la direction"],
      media_changes_requested: ["Corriger le média selon la consigne reçue", "Retour média de la direction à intégrer"],
      final_approved: ["Publier ou programmer la publication", "Texte et média approuvés : feu vert de diffusion"]
    };
    const action = adminActions[event.stage];
    if (!action) return null;
    return { ...event, action: action[0], whyNow: action[1], updatedAt: baseUpdatedAt };
  }

  return null;
}

function urgencyFor(decision, now) {
  if (!decision.date) return { rank: 3, dateValue: Number.POSITIVE_INFINITY, className: "undated" };
  const publicationTarget = new Date(
    decision.date.getFullYear(),
    decision.date.getMonth(),
    decision.date.getDate(),
    7,
    30,
    0,
    0
  );
  const hoursUntilPublication = (publicationTarget - now) / 3600000;
  if (hoursUntilPublication <= 48) {
    return { rank: 0, dateValue: publicationTarget.valueOf(), className: "urgent" };
  }

  // Semaine locale du lundi au dimanche. Le repère demeure visuel et ne
  // déclenche aucune lecture ou écriture supplémentaire dans Firestore.
  const weekEnd = dayStart(now);
  const mondayBasedDay = (weekEnd.getDay() + 6) % 7;
  weekEnd.setDate(weekEnd.getDate() - mondayBasedDay + 6);
  weekEnd.setHours(23, 59, 59, 999);
  if (publicationTarget <= weekEnd) {
    return { rank: 1, dateValue: publicationTarget.valueOf(), className: "current-week" };
  }
  return { rank: 2, dateValue: publicationTarget.valueOf(), className: "later" };
}

function roleDecisionModels(events, role, now) {
  const tasks = role === "admin" ? pendingTaskModels(role) : [];
  const personalActions = personalActionItemModels(role);
  const personalEventIds = new Set(personalActions.filter((item) => item.targetType === "schedule").map((item) => item.targetId));
  const tasksByEvent = new Map();
  tasks.filter((task) => task.targetType === "schedule").forEach((task) => {
    const rows = tasksByEvent.get(task.targetId) || [];
    rows.push(task);
    tasksByEvent.set(task.targetId, rows);
  });

  const eventDecisions = events
    .filter((event) => !personalEventIds.has(event.id))
    .map((event) => roleDecisionForEvent(event, role, tasksByEvent.get(event.id) || []))
    .filter(Boolean);
  const sectionTasks = role === "admin" ? tasks.filter((task) => task.targetType === "section").map((task) => ({
    id: `task-${task.id}`,
    taskId: task.id,
    targetType: task.targetType,
    targetId: task.targetId,
    title: task.title,
    date: null,
    dateLabel: "Sans date",
    theme: "Suivi transmis par la direction",
    action: task.title,
    whyNow: task.isComment ? "Nouvelle consigne de la direction" : "Action de coordination à traiter",
    updatedAt: task.updatedAt
  })) : [];

  const actionDecisions = personalActions.map((item) => {
    const event = item.targetType === "schedule" ? events.find((candidate) => candidate.id === item.targetId) : null;
    const directionMediaDone = event?.media?.directionSelected === true;
    if (["approve_text_then_media", "media_direction_approval"].includes(item.actionType)
      && (directionMediaDone || ["final_approved", "scheduled", "published"].includes(event?.stage))) return null;
    const date = event?.date || inferDate(item.eventDateIso, now);
    const waitingForMedia = item.actionType === "approve_text_then_media"
      && event?.media?.count > 0
      && ["content_approved", "media_in_progress", "media_review", "media_changes_requested"].includes(event?.stage);
    if (item.actionType === "approve_text_then_media"
      && event
      && ["content_approved", "media_in_progress", "media_review", "media_changes_requested"].includes(event.stage)
      && event.media.count === 0) return null;
    return {
      ...(event || {}),
      id: `action-${item.id}`,
      actionItemId: item.id,
      targetType: item.targetType,
      targetId: item.targetId,
      mediaId: item.mediaId,
      title: event?.title || item.title,
      date,
      dateLabel: event?.dateLabel || item.eventDateIso,
      theme: event?.theme || "Décision personnelle",
      action: waitingForMedia ? "Choisir et approuver le visuel recommandé" : item.title,
      whyNow: waitingForMedia ? "Le texte est approuvé : la porte média est maintenant ouverte." : (item.message || "Action assignée à votre rôle"),
      updatedAt: Math.max(event?.workflowUpdatedAt || 0, item.updatedAt),
      priorityKey: Number.isFinite(item.priorityKey) ? item.priorityKey : 9999,
      queueDateIso: item.eventDateIso,
      queueSourceRank: 0
    };
  }).filter(Boolean);

  return [...actionDecisions, ...eventDecisions, ...sectionTasks].map((decision) => ({
    ...decision,
    queueSourceRank: decision.queueSourceRank ?? 1,
    urgency: urgencyFor(decision, now)
  })).sort((left, right) =>
    left.urgency.rank - right.urgency.rank
    || left.urgency.dateValue - right.urgency.dateValue
    || left.queueSourceRank - right.queueSourceRank
    || (left.queueSourceRank === 0 ? (left.priorityKey - right.priorityKey
      || String(left.queueDateIso).localeCompare(String(right.queueDateIso))
      || String(left.actionItemId).localeCompare(String(right.actionItemId))) : 0)
    ||
    String(left.id).localeCompare(String(right.id), "fr")
    || right.updatedAt - left.updatedAt
    || left.title.localeCompare(right.title, "fr")
  );
}

function linkButton(event, label = "Ouvrir") {
  if (event.taskId) return `<button type="button" class="vm-open" data-vm-task="${escapeHtml(event.taskId)}">${escapeHtml(label)}<span aria-hidden="true">→</span></button>`;
  const targetId = event.targetId || event.id;
  return `<button type="button" class="vm-open" data-vm-target="${escapeHtml(targetId)}" data-vm-entity-type="${escapeHtml(event.targetType || "schedule")}"${event.mediaId ? ` data-vm-media="${escapeHtml(event.mediaId)}"` : ""}>${escapeHtml(label)}<span aria-hidden="true">→</span></button>`;
}

function estimatedDecisionMinutes(event, role) {
  const text = `${event.action || ""} ${event.whyNow || ""} ${event.title || ""}`.toLocaleLowerCase("fr");
  if (event.targetType === "internal-project" || event.targetType === "opportunity" || event.targetType === "section") return role === "director" ? 10 : 25;
  if (/choisir|approuver|valider|confirmer le visuel|confirmer le texte/.test(text)) return role === "director" ? 3 : 5;
  if (/commentaire|consigne|arbitrer|signaler/.test(text)) return role === "director" ? 5 : 15;
  if (/publier|programmer|terminer/.test(text)) return 10;
  if (/réviser|corriger|produire|préparer|intégrer/.test(text)) return role === "director" ? 5 : 25;
  return role === "director" ? 5 : 15;
}

function formatEstimatedMinutes(minutes) {
  if (minutes < 60) return `≈ ${minutes} min`;
  return `≈ ${String(Math.round(minutes / 15) / 4).replace(".", ",")} h`;
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

function compactEvent(event, now, { showAction = true, showReason = false } = {}) {
  const estimate = estimatedDecisionMinutes(event, runtime.identity.role);
  return `<article class="vm-event${event.urgency?.className ? ` priority-${event.urgency.className}` : ""}">
    <div><span class="vm-event-date">${escapeHtml(relativeDateLabel(event.date, now))}</span><span class="vm-time-estimate" aria-label="Durée approximative ${estimate} minutes">${formatEstimatedMinutes(estimate)}</span><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.theme)}${showAction ? ` · ${escapeHtml(event.action)}` : ""}</p></div>
    ${showReason ? `<span class="vm-why-now"><b>Pourquoi maintenant</b>${escapeHtml(event.whyNow || "Action à traiter")}</span>` : ""}
    ${linkButton(event)}
  </article>`;
}

function gateIsDone(card, gate) {
  return Boolean(card.querySelector(`[data-gate="${gate}"][aria-pressed="true"], [data-gate="${gate}"].done`));
}

function setCardExpanded(card, expanded) {
  if (!card) return;
  const isExpanded = Boolean(expanded);
  card.classList.toggle("vm-expanded", isExpanded);
  const toggle = card.querySelector(":scope > .vm-card-summary [data-vm-card-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.textContent = isExpanded ? "− Réduire" : "+ Voir et décider";
  }
  const head = card.querySelector(":scope > .post-head[data-vm-header-toggle]");
  if (head) {
    const title = head.querySelector("h4")?.textContent?.trim() || "cette publication";
    head.setAttribute("aria-expanded", String(isExpanded));
    head.setAttribute("aria-label", `${isExpanded ? "Réduire" : "Voir et décider"} — ${title}`);
  }
  card.querySelector(":scope > .vm-card-summary")?.removeAttribute("data-signature");
}

function configureCardHeaderToggle(card, head, expanded) {
  if (runtime.mode !== "essential") {
    delete head.dataset.vmHeaderToggle;
    head.removeAttribute("role");
    head.removeAttribute("tabindex");
    head.removeAttribute("aria-expanded");
    head.removeAttribute("aria-label");
    return;
  }
  const title = head.querySelector("h4")?.textContent?.trim() || "cette publication";
  head.dataset.vmHeaderToggle = "";
  head.setAttribute("role", "button");
  head.setAttribute("tabindex", "0");
  head.setAttribute("aria-expanded", String(expanded));
  head.setAttribute("aria-label", `${expanded ? "Réduire" : "Voir et décider"} — ${title}`);
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
    configureCardHeaderToggle(card, head, expanded);
    const signature = JSON.stringify({ action, state, expanded });
    if (summary.dataset.signature === signature) return;
    summary.dataset.signature = signature;
    const step = (label, done) => `<span class="${done ? "done" : ""}"><i aria-hidden="true">${done ? "✓" : "○"}</i>${label}</span>`;
    summary.innerHTML = `
      <div class="vm-card-next"><small>Prochaine étape</small><b>${escapeHtml(action)}</b></div>
      <div class="vm-card-progress" aria-label="Texte ${state.content ? "approuvé" : "à valider"}; média ${state.media ? "approuvé" : "à valider"}; publication ${state.publication ? "terminée" : "à faire"}">
        ${step("Texte", state.content)}${step("Média", state.media)}${step("Publication", state.publication)}
      </div>
      <button type="button" data-vm-card-toggle aria-expanded="${expanded}">${expanded ? "− Réduire" : "+ Voir et décider"}</button>`;
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
  // File strictement personnelle : aucun élément « en attente de l’autre
  // rôle » n’est mélangé aux actions de la personne connectée.
  const allDecisions = roleDecisionModels(events, runtime.identity.role, now);
  const pageSize = queuePageSize();
  if (runtime.queueRole !== runtime.identity.role) {
    runtime.queueRole = runtime.identity.role;
    runtime.queueVisibleCount = pageSize;
  }
  runtime.queueVisibleCount = Math.max(pageSize, runtime.queueVisibleCount || 0);
  const decisions = allDecisions.slice(0, runtime.queueVisibleCount);
  const messages = messageModels();

  const todayBody = today.length
    ? today.map((event) => compactEvent(event, now)).join("")
    : empty("Aucune publication prévue aujourd’hui.");
  const remainingDecisions = Math.max(0, allDecisions.length - decisions.length);
  const actionSource = document.querySelector("#cockpit-action-item-source");
  const remoteMore = actionSource?.dataset.hasMore === "true";
  const remoteLoading = actionSource?.dataset.loading === "true";
  const remoteError = actionSource?.dataset.error || "";
  const queueFooter = remainingDecisions || remoteMore || remoteError
    ? `<div class="vm-queue-footer"><p>${remoteError ? "La suite distante est momentanément indisponible." : remoteMore ? "D’autres décisions personnelles peuvent être chargées." : `${remainingDecisions} autre${remainingDecisions > 1 ? "s" : ""} décision${remainingDecisions > 1 ? "s" : ""} dans votre file.`}</p><button type="button" data-vm-load-more${remoteLoading ? " disabled aria-busy=\"true\"" : ""}>${remoteError ? "Réessayer" : remoteLoading ? "Chargement…" : "Charger plus"}</button></div>`
    : decisions.length ? `<p class="vm-queue-end">Fin de la file · toutes vos décisions chargées.</p>` : "";
  const decisionsBody = decisions.length
    ? decisions.map((event) => compactEvent(event, now, { showReason: true })).join("") + queueFooter
    : `<div class="vm-all-clear"><b>Tout est à jour.</b><span>Aucune décision n’est requise pour le moment.</span></div>`;
  const weekBody = nextWeek.length
    ? nextWeek.map((event) => compactEvent(event, now, { showAction: false })).join("")
    : empty("Aucun événement au cours des sept prochains jours.");
  const messagesBody = messages.length
    ? messages.map((message) => `<article class="vm-message"><div><span>${escapeHtml(message.author)}${message.when ? ` · ${escapeHtml(message.when)}` : ""}</span><h3>${escapeHtml(message.event.title)}</h3><p>${escapeHtml(message.text)}</p></div>${linkButton(message.event, "Répondre")}</article>`).join("")
    : empty("Aucun message actif dans les événements visibles.");

  grid.innerHTML = [
    panel("decision", "Décisions qui m’attendent", `${allDecisions.length}${remoteMore ? "+" : ""} pour vous`, decisionsBody, "vm-decisions"),
    panel("today", "Aujourd’hui", `${today.length} événement${today.length > 1 ? "s" : ""}`, todayBody, "vm-today"),
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

async function runNavigation(control, target) {
  if (!control || control.dataset.vmNavigating === "true") return;
  const original = control.innerHTML;
  control.dataset.vmNavigating = "true";
  control.setAttribute("aria-busy", "true");
  control.disabled = true;
  control.textContent = "Ouverture…";
  try {
    await navigateToEntity(target);
  } finally {
    control.disabled = false;
    control.removeAttribute("aria-busy");
    delete control.dataset.vmNavigating;
    control.innerHTML = original;
  }
}

function loadMoreDecisions(control) {
  if (!control || control.dataset.vmLoading === "true") return;
  control.dataset.vmLoading = "true";
  control.disabled = true;
  control.setAttribute("aria-busy", "true");
  control.textContent = "Chargement…";
  const actionSource = document.querySelector("#cockpit-action-item-source");
  if (actionSource?.dataset.hasMore === "true" || actionSource?.dataset.error) {
    window.dispatchEvent(new CustomEvent("cockpit:load-more-action-items"));
  }
  setTimeout(() => {
    try {
      runtime.queueVisibleCount += queuePageSize();
      renderDashboard();
      announce("La page suivante de votre file est chargée.");
    } catch {
      control.disabled = false;
      control.removeAttribute("aria-busy");
      delete control.dataset.vmLoading;
      control.textContent = "Réessayer";
      announce("La suite de la file n’a pas pu être affichée. Réessayez.");
    }
  }, 0);
}

function scheduleRender() {
  clearTimeout(runtime.renderTimer);
  runtime.renderTimer = setTimeout(() => renderDashboard(), 80);
}

function observeDataDom() {
  runtime.observer?.disconnect();
  const targets = [document.querySelector("#posts"), document.querySelector("#cockpit-sidebar"), document.querySelector("#cockpit-action-item-source")].filter(Boolean);
  if (!targets.length) return;
  runtime.observer = new MutationObserver(scheduleRender);
  targets.forEach((target) => runtime.observer.observe(target, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["class", "aria-pressed", "hidden", "data-status", "data-workflow-stage", "data-workflow-updated-at", "data-editorial-updated-at", "data-media-updated-at", "data-media-selected-final", "data-media-communications-selected", "data-media-direction-selected", "data-task-updated-at"]
  }));
}

function refreshIdentity(detail = null) {
  const next = detectIdentity(detail);
  const changed = next.uid !== runtime.identity.uid || next.role !== runtime.identity.role;
  runtime.identity = next;
  if (changed) {
    runtime.queueRole = "";
    runtime.queueVisibleCount = 0;
  }
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
  const cardHeader = event.target.closest("[data-vm-header-toggle]");
  const nestedInteractive = event.target.closest("a, button, input, textarea, select, summary, [role='button']");
  if (cardHeader && (!nestedInteractive || nestedInteractive === cardHeader)) {
    const card = cardHeader.closest(".post[data-item-id]");
    if (!card) return;
    setCardExpanded(card, !card.classList.contains("vm-expanded"));
    return;
  }
  const cardToggle = event.target.closest("[data-vm-card-toggle]");
  if (cardToggle) {
    const card = cardToggle.closest(".post[data-item-id]");
    if (!card) return;
    setCardExpanded(card, !card.classList.contains("vm-expanded"));
    return;
  }
  const target = event.target.closest("[data-vm-target]");
  if (target) {
    void runNavigation(target, { type: target.dataset.vmEntityType || "schedule", id: target.dataset.vmTarget, mediaId: target.dataset.vmMedia || "" });
    return;
  }
  const task = event.target.closest("[data-vm-task]");
  if (task) {
    void runNavigation(task, { type: "task", id: task.dataset.vmTask });
    return;
  }
  const retry = event.target.closest("[data-vm-retry-type][data-vm-retry-id]");
  if (retry) {
    void runNavigation(retry, { type: retry.dataset.vmRetryType, id: retry.dataset.vmRetryId });
    return;
  }
  const loadMore = event.target.closest("[data-vm-load-more]");
  if (loadMore) loadMoreDecisions(loadMore);
}

function handleKeydown(event) {
  if (!['Enter', ' '].includes(event.key)) return;
  const cardHeader = event.target.closest?.("[data-vm-header-toggle]");
  if (!cardHeader || event.target !== cardHeader) return;
  const card = cardHeader.closest(".post[data-item-id]");
  if (!card) return;
  event.preventDefault();
  setCardExpanded(card, !card.classList.contains("vm-expanded"));
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
  listen(document, "keydown", handleKeydown);
  listen(window, "cockpit:content-ready", () => update());
  listen(window, "cockpit:action-items-updated", () => update());
  listen(window, "cockpit:session-ready", (event) => update(event.detail || {}));
  listen(window, "cockpit:session-ended", () => {
    runtime.identity = { uid: "", role: "" };
    runtime.explicitMode = false;
    runtime.queueRole = "";
    runtime.queueVisibleCount = 0;
    runtime.navigationToken += 1;
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
  runtime.navigationToken += 1;
  runtime.queueRole = "";
  runtime.queueVisibleCount = 0;
}

// Autonome lorsque chargé directement; init() reste exporté pour les tests et
// les intégrations qui souhaitent fournir explicitement l'uid et le rôle.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init(), { once: true });
} else {
  init();
}
