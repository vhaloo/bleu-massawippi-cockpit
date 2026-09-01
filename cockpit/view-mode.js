/**
 * Vue essentielle / Vue complète du Cockpit Communication Bleu Massawippi.
 *
 * Ce module ne possède aucune donnée métier et n'écrit jamais dans Firestore.
 * Il résume le DOM déjà rendu par cockpit-ui.js, puis renvoie toujours vers les
 * contrôles d'origine. Une panne de ce module laisse donc le cockpit complet
 * intact.
 */

import { notificationDecisionToken, notificationOwnerKey, notificationRecipientMatches, notificationSystemTag } from "./notification-recipient.js?v=20260901-b70";

const MODULE_ID = "cockpit-view-mode";
const STORAGE_PREFIX = "bleu-massawippi-view-mode";
const MESSAGE_SEEN_PREFIX = "bleu-massawippi-message-seen-v1";
const DECISION_DOCK_PREFIX = "bleu-massawippi-decision-dock-v1";
const ATTENTION_PREFIX = "bleu-massawippi-attention-v1";
const CARD_EXPANSION_PREFIX = "bleu-massawippi-card-expansion-v1";
const VALID_MODES = new Set(["essential", "complete"]);
const QUEUE_PAGE_SIZE = Object.freeze({ director: 5, admin: 7 });
const NAVIGATION_ATTEMPTS = 5;
const NAVIGATION_DELAY_MS = 60;
const CONTENT_NOTICE_DWELL_MS = 2200;
const ATTENTION_DWELL_MS = 1800;
const ATTENTION_TOKEN_LIMIT = 240;
const DECISION_DOCK_MIN_WIDTH = 1180;
const DECISION_DOCK_PANEL_MIN_WIDTH = 200;
const DECISION_DOCK_PANEL_MAX_WIDTH = 318;
const DECISION_DOCK_EDGE = 12;
const DECISION_DOCK_GAP = 18;
const DECISION_DOCK_INLINE_MAX_WIDTH = 700;
const DECISION_DOCK_TAB_CLEARANCE = 72;
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
  queueOwner: "",
  queueVisibleCount: 0,
  contentNoticeTimer: 0,
  contentNoticeTarget: null,
  decisionDockCollapsed: false,
  decisionDockForcedOpen: false,
  decisionDockHasItems: false,
  attentionEnabled: true,
  attentionCurrent: false,
  attentionUnseen: false,
  attentionTokens: [],
  attentionSeenTokens: new Set(),
  attentionSignature: "",
  attentionReviewTimer: 0,
  systemNotificationsEnabled: false,
  lastNotifiedSignature: "",
  systemNotificationInFlight: false
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

function identityStorageOwner(identity = runtime.identity) {
  return notificationOwnerKey(identity);
}

function cardExpansionStorageKey(itemId, identity = runtime.identity) {
  return `${CARD_EXPANSION_PREFIX}:${identityStorageOwner(identity)}:${encodeURIComponent(String(itemId || ""))}`;
}

function readCardExpansion(itemId, identity = runtime.identity) {
  try { return localStorage.getItem(cardExpansionStorageKey(itemId, identity)) === "open"; }
  catch { return false; }
}

function writeCardExpansion(itemId, expanded) {
  if (!itemId) return;
  try { localStorage.setItem(cardExpansionStorageKey(itemId), expanded ? "open" : "closed"); }
  catch { /* la préférence reste utilisable pendant la session */ }
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

function decisionDockStorageKey(identity = runtime.identity) {
  const owner = identity.uid ? `uid:${identity.uid}` : identity.role ? `role:${identity.role}` : "device";
  return `${DECISION_DOCK_PREFIX}:${owner}`;
}

function readDecisionDockPreference(identity = runtime.identity) {
  try { return localStorage.getItem(decisionDockStorageKey(identity)) === "collapsed"; }
  catch { return false; }
}

function writeDecisionDockPreference(collapsed) {
  try { localStorage.setItem(decisionDockStorageKey(), collapsed ? "collapsed" : "expanded"); }
  catch { /* préférence limitée à la session */ }
}

function attentionStorageKey(identity = runtime.identity) {
  const owner = identity.uid ? `uid:${identity.uid}` : identity.role ? `role:${identity.role}` : "device";
  return `${ATTENTION_PREFIX}:${owner}`;
}

function readAttentionPreference(identity = runtime.identity) {
  try {
    const parsed = JSON.parse(localStorage.getItem(attentionStorageKey(identity)) || "null");
    return {
      enabled: parsed?.enabled !== false,
      systemNotificationsEnabled: parsed?.systemNotificationsEnabled === true,
      lastNotifiedSignature: typeof parsed?.lastNotifiedSignature === "string" ? parsed.lastNotifiedSignature : "",
      seenTokens: Array.isArray(parsed?.seenTokens)
        ? parsed.seenTokens.filter((token) => typeof token === "string").slice(0, ATTENTION_TOKEN_LIMIT)
        : []
    };
  } catch {
    return { enabled: true, systemNotificationsEnabled: false, lastNotifiedSignature: "", seenTokens: [] };
  }
}

function writeAttentionPreference() {
  try {
    localStorage.setItem(attentionStorageKey(), JSON.stringify({
      enabled: runtime.attentionEnabled,
      systemNotificationsEnabled: runtime.systemNotificationsEnabled,
      lastNotifiedSignature: runtime.lastNotifiedSignature,
      seenTokens: [...runtime.attentionSeenTokens].slice(0, ATTENTION_TOKEN_LIMIT)
    }));
  } catch { /* l'indicateur reste utilisable pendant la session */ }
}

function hydrateAttentionPreference(identity = runtime.identity) {
  const saved = readAttentionPreference(identity);
  runtime.attentionEnabled = saved.enabled;
  runtime.systemNotificationsEnabled = saved.systemNotificationsEnabled;
  runtime.lastNotifiedSignature = saved.lastNotifiedSignature;
  runtime.attentionSeenTokens = new Set(saved.seenTokens);
  runtime.attentionCurrent = false;
  runtime.attentionUnseen = false;
  runtime.attentionTokens = [];
  runtime.attentionSignature = "";
  clearAttentionReview();
  updateAppAttentionBadge(false);
}

function updateAppAttentionBadge(active) {
  // L'API Badging affiche un simple indicateur lorsqu'elle est appelée sans
  // nombre. Elle est facultative : le point dans l'interface reste le repli.
  try {
    const operation = active
      ? globalThis.navigator?.setAppBadge?.()
      : globalThis.navigator?.clearAppBadge?.();
    operation?.catch?.(() => {});
  } catch { /* navigateur sans Badging API ou permission locale refusée */ }
}

function systemNotificationStatus() {
  const supported = typeof globalThis.Notification !== "undefined"
    && Boolean(globalThis.navigator?.serviceWorker?.ready);
  return {
    supported,
    permission: supported ? String(globalThis.Notification.permission || "default") : "unsupported"
  };
}

async function closeAttentionSystemNotifications() {
  const { supported } = systemNotificationStatus();
  if (!supported) return;
  try {
    const registration = await globalThis.navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications?.({ tag: notificationSystemTag(runtime.identity) });
    notifications?.forEach?.((notification) => notification.close?.());
  } catch { /* le badge et le point rouge restent le repli fiable */ }
}

async function showSystemNotification({ title, body, tag = notificationSystemTag(runtime.identity), data = {} }) {
  const status = systemNotificationStatus();
  if (!status.supported || status.permission !== "granted") return false;
  try {
    const registration = await globalThis.navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      tag,
      renotify: false,
      silent: true,
      icon: "./assets/brand/cockpit-bleu-massawippi-icon-192.png",
      badge: "./assets/brand/cockpit-bleu-massawippi-icon-192.png",
      data: { url: "./?notification=decisions", ...data }
    });
    return true;
  } catch {
    return false;
  }
}

async function notifySystemOfNewAttention() {
  const active = runtime.attentionEnabled && runtime.attentionCurrent && runtime.attentionUnseen;
  const status = systemNotificationStatus();
  const backgrounded = document.visibilityState === "hidden"
    || (typeof document.hasFocus === "function" && !document.hasFocus());
  if (!active || !runtime.systemNotificationsEnabled || status.permission !== "granted" || !backgrounded) return;
  if (!runtime.attentionSignature || runtime.attentionSignature === runtime.lastNotifiedSignature || runtime.systemNotificationInFlight) return;
  runtime.systemNotificationInFlight = true;
  const body = "De nouvelles actions personnelles attendent votre attention dans le cockpit.";
  try {
    const shown = await showSystemNotification({
      title: "Cockpit Bleu Massawippi — nouveautés à voir",
      body,
      data: { role: runtime.identity.role }
    });
    if (shown) {
      runtime.lastNotifiedSignature = runtime.attentionSignature;
      writeAttentionPreference();
    }
  } finally {
    runtime.systemNotificationInFlight = false;
  }
}

async function toggleSystemNotifications(control) {
  const status = systemNotificationStatus();
  if (!status.supported) {
    announce("Les notifications système ne sont pas disponibles sur cet appareil. Le point rouge reste actif.");
    return;
  }
  control?.setAttribute("aria-busy", "true");
  if (control) control.disabled = true;
  try {
    let permission = status.permission;
    if (permission === "default") permission = await globalThis.Notification.requestPermission();
    if (permission !== "granted") {
      runtime.systemNotificationsEnabled = false;
      writeAttentionPreference();
      updateAttentionSurfaces();
      announce(permission === "denied"
        ? "Les notifications système sont bloquées dans les réglages de cet appareil."
        : "L’autorisation de notification n’a pas été accordée.");
      return;
    }
    runtime.systemNotificationsEnabled = !runtime.systemNotificationsEnabled;
    if (runtime.systemNotificationsEnabled) {
      runtime.lastNotifiedSignature = runtime.attentionSignature;
      writeAttentionPreference();
      await showSystemNotification({
        title: "Notifications du cockpit activées",
        body: "Vous serez averti des prochaines nouveautés lorsque le cockpit est ouvert ou en arrière-plan.",
        tag: notificationSystemTag(runtime.identity, "notification-ready"),
        data: { kind: "confirmation" }
      });
    } else {
      writeAttentionPreference();
      await closeAttentionSystemNotifications();
    }
    updateAttentionSurfaces();
    announce(runtime.systemNotificationsEnabled
      ? "Notifications système activées sur cet appareil."
      : "Notifications système désactivées sur cet appareil.");
  } catch {
    runtime.systemNotificationsEnabled = false;
    writeAttentionPreference();
    announce("Les notifications système n’ont pas pu être activées sur cet appareil. Le point rouge reste disponible.");
  } finally {
    control?.removeAttribute("aria-busy");
    updateAttentionSurfaces();
  }
}

function ensureAttentionControls() {
  const panel = document.querySelector("#vm-panel-decision");
  const body = panel?.querySelector(":scope > .vm-panel-body");
  if (!panel || !body) return null;
  let controls = panel.querySelector(":scope > [data-vm-attention-controls]");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "vm-attention-controls";
    controls.dataset.vmAttentionControls = "";
    controls.innerHTML = `
      <span class="vm-attention-state"><i class="vm-attention-dot" data-vm-attention-dot hidden aria-hidden="true"></i><span><b data-vm-attention-title></b><small data-vm-attention-copy></small><small class="vm-system-notification-copy" data-vm-system-notification-copy></small></span></span>
      <span class="vm-attention-actions"><button type="button" data-vm-attention-seen>Tout marquer comme vu</button><button type="button" data-vm-system-notification></button><button type="button" data-vm-attention-toggle aria-pressed="true"></button></span>`;
    body.before(controls);
  }
  return controls;
}

function updateAttentionSurfaces() {
  const active = runtime.attentionEnabled && runtime.attentionCurrent && runtime.attentionUnseen;
  updateAppAttentionBadge(active);
  document.documentElement.classList.toggle("cockpit-has-unseen", active);
  document.querySelectorAll("[data-vm-attention-dot]").forEach((dot) => {
    dot.hidden = !active;
    dot.setAttribute("aria-hidden", String(!active));
  });
  const nav = document.querySelector('[data-vm-nav="decision"]');
  if (nav) nav.setAttribute("aria-label", active ? "Décisions — nouveauté non vue" : "Décisions");

  const controls = ensureAttentionControls();
  if (!controls) return;
  controls.classList.toggle("has-unseen", active);
  controls.classList.toggle("is-disabled", !runtime.attentionEnabled);
  const title = controls.querySelector("[data-vm-attention-title]");
  const copy = controls.querySelector("[data-vm-attention-copy]");
  if (title) title.textContent = !runtime.attentionEnabled ? "Notifications désactivées sur cet appareil" : active ? "Nouveautés à voir" : "À jour sur cet appareil";
  if (copy) copy.textContent = !runtime.attentionEnabled
    ? "Vos décisions restent disponibles normalement."
    : active ? "Un coup d’œil à votre file suffit pour retirer le point rouge." : "Le point rouge reviendra seulement lorsqu’une décision change ou s’ajoute.";
  const systemCopy = controls.querySelector("[data-vm-system-notification-copy]");
  const systemStatus = systemNotificationStatus();
  if (systemCopy) systemCopy.textContent = !systemStatus.supported
    ? "Le point rouge et le badge d’application restent disponibles sur ce navigateur."
    : systemStatus.permission === "denied"
      ? "Notifications système bloquées dans les réglages de cet appareil."
      : runtime.systemNotificationsEnabled
        ? "Zéro lecture en plus : notification système lorsque le cockpit est ouvert ou en arrière-plan."
        : "Vous pouvez autoriser une notification système; aucune lecture Firebase ne sera ajoutée.";
  const seen = controls.querySelector("[data-vm-attention-seen]");
  if (seen) seen.hidden = !active;
  const toggle = controls.querySelector("[data-vm-attention-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(runtime.attentionEnabled));
    toggle.textContent = runtime.attentionEnabled ? "Notifications activées" : "Réactiver les notifications";
    toggle.title = runtime.attentionEnabled
      ? "Désactiver les notifications de nouveauté uniquement sur cet appareil"
      : "Réactiver les notifications de nouveauté sur cet appareil";
  }
  const systemToggle = controls.querySelector("[data-vm-system-notification]");
  if (systemToggle) {
    systemToggle.hidden = !systemStatus.supported;
    systemToggle.disabled = systemStatus.permission === "denied";
    systemToggle.setAttribute("aria-pressed", String(runtime.systemNotificationsEnabled && systemStatus.permission === "granted"));
    systemToggle.textContent = systemStatus.permission === "denied"
      ? "Notifications système bloquées"
      : runtime.systemNotificationsEnabled && systemStatus.permission === "granted"
        ? "Notifications système activées"
        : "Activer les notifications système";
    systemToggle.title = "Autoriser une notification discrète lorsqu’une nouvelle décision arrive pendant que le cockpit est ouvert ou en arrière-plan.";
  }
}

function clearAttentionReview() {
  clearTimeout(runtime.attentionReviewTimer);
  runtime.attentionReviewTimer = 0;
}

function markCurrentAttentionSeen({ announceChange = true } = {}) {
  if (!runtime.attentionCurrent) return;
  const merged = [...new Set([...runtime.attentionTokens, ...runtime.attentionSeenTokens])].slice(0, ATTENTION_TOKEN_LIMIT);
  runtime.attentionSeenTokens = new Set(merged);
  runtime.attentionUnseen = false;
  clearAttentionReview();
  void closeAttentionSystemNotifications();
  writeAttentionPreference();
  updateAttentionSurfaces();
  if (announceChange) announce("Nouveautés marquées comme vues sur cet appareil.");
}

function decisionReviewIsVisible() {
  if (document.visibilityState === "hidden" || runtime.mode !== "essential") return false;
  const panel = document.querySelector("#vm-panel-decision");
  const dock = document.querySelector("#vm-decision-dock.is-visible");
  return isMeaningfullyVisible(panel) || isMeaningfullyVisible(dock);
}

function scheduleAttentionReview() {
  if (runtime.attentionReviewTimer || !runtime.attentionEnabled || !runtime.attentionCurrent || !runtime.attentionUnseen) return;
  const dwell = Number.isFinite(Number(runtime.options.attentionDwellMs))
    ? Math.max(250, Number(runtime.options.attentionDwellMs))
    : ATTENTION_DWELL_MS;
  runtime.attentionReviewTimer = setTimeout(() => {
    runtime.attentionReviewTimer = 0;
    if (runtime.attentionUnseen && decisionReviewIsVisible()) markCurrentAttentionSeen({ announceChange: false });
  }, dwell);
}

function syncAttentionSnapshot(decisions, { current = false } = {}) {
  const tokens = current ? decisions.map((decision) => notificationDecisionToken(runtime.identity, decision)) : [];
  const signature = tokens.join("|");
  if (signature !== runtime.attentionSignature) clearAttentionReview();
  runtime.attentionSignature = signature;
  runtime.attentionTokens = tokens;
  runtime.attentionCurrent = Boolean(current);
  runtime.attentionUnseen = Boolean(current && tokens.some((token) => !runtime.attentionSeenTokens.has(token)));
  updateAttentionSurfaces();
  void notifySystemOfNewAttention();
  scheduleAttentionReview();
}

function toggleAttentionPreference() {
  runtime.attentionEnabled = !runtime.attentionEnabled;
  runtime.attentionUnseen = runtime.attentionEnabled
    && runtime.attentionCurrent
    && runtime.attentionTokens.some((token) => !runtime.attentionSeenTokens.has(token));
  clearAttentionReview();
  writeAttentionPreference();
  updateAttentionSurfaces();
  if (!runtime.attentionEnabled) void closeAttentionSystemNotifications();
  scheduleAttentionReview();
  announce(runtime.attentionEnabled ? "Notifications de nouveauté activées sur cet appareil." : "Notifications de nouveauté désactivées sur cet appareil.");
}

async function openAttentionFromSystemNotification() {
  if (!runtime.initialized) return;
  applyMode("essential");
  renderDashboard(runtime.options.now instanceof Date ? runtime.options.now : new Date());
  await delay(0);
  const panel = document.querySelector("#vm-panel-decision");
  if (!panel) return;
  panel.scrollIntoView?.({
    behavior: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
    block: "start"
  });
  try { panel.focus?.({ preventScroll: true }); } catch { panel.focus?.(); }
  scheduleAttentionReview();
}

function attentionLaunchRequested() {
  try { return new URLSearchParams(globalThis.location?.search || "").get("notification") === "decisions"; }
  catch { return false; }
}

function decisionDockLabels(role = runtime.identity.role) {
  if (role === "admin") {
    return {
      eyebrow: "Communications",
      title: "À accomplir maintenant",
      tab: "Mes tâches"
    };
  }
  return {
    eyebrow: "Direction générale",
    title: "Décisions qui m’attendent",
    tab: "Mes décisions"
  };
}

function defaultMode(identity) {
  if (identity.role === "director") return "essential";
  return "complete";
}

function ensureStylesheet() {
  if (document.querySelector(`link[data-module="${MODULE_ID}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./view-mode.css?v=20260901-b70", import.meta.url).href;
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

function ensureDecisionDock() {
  let dock = document.querySelector("#vm-decision-dock");
  if (!dock) {
    dock = document.createElement("aside");
    dock.id = "vm-decision-dock";
    dock.className = "vm-decision-dock";
    dock.setAttribute("aria-hidden", "true");
    dock.innerHTML = `
      <header><div><small data-vm-dock-eyebrow></small><b data-vm-dock-title></b><span data-vm-dock-count></span></div><button type="button" data-vm-dock-toggle aria-controls="vm-decision-dock-body" aria-expanded="true" aria-label="Masquer le panneau vers sa languette">−</button></header>
      <div id="vm-decision-dock-body" class="vm-decision-dock-body" data-vm-dock-body></div>
      <footer><button type="button" data-vm-dock-return>↑ Retour au tableau</button></footer>`;
    document.body.appendChild(dock);
  }
  let tab = document.querySelector("#vm-decision-dock-tab");
  if (!tab) {
    tab = document.createElement("button");
    tab.type = "button";
    tab.id = "vm-decision-dock-tab";
    tab.className = "vm-decision-dock-tab";
    tab.dataset.vmDockTab = "";
    tab.setAttribute("aria-controls", "vm-decision-dock");
    tab.setAttribute("aria-expanded", "false");
    tab.setAttribute("aria-hidden", "true");
    tab.tabIndex = -1;
    tab.innerHTML = `<span class="vm-decision-dock-tab-handle" aria-hidden="true">›</span><span data-vm-dock-tab-label></span><span data-vm-dock-tab-short aria-hidden="true">À faire</span><strong data-vm-dock-tab-count></strong><i class="vm-attention-dot vm-attention-dot-dock" data-vm-attention-dot hidden aria-hidden="true"></i>`;
    document.body.appendChild(tab);
  }
  return dock;
}

function decisionDockAvailableWidth() {
  const explicit = Number(runtime.options.decisionDockAvailableWidth);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);

  const viewportWidth = Number(document.documentElement?.clientWidth || globalThis.innerWidth || 0);
  const selectors = [
    "#cockpit-essential-dashboard",
    "#cockpit-content .hero.wrap",
    "#cockpit-content > .wrap",
    "#cockpit-content .section.wrap"
  ];
  let left = 0;
  for (const selector of selectors) {
    const candidate = document.querySelector(selector);
    const rect = candidate?.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.left > 0) {
      left = rect.left;
      break;
    }
  }
  if (!left && viewportWidth) {
    const contentWidth = Math.min(1280, Math.max(0, viewportWidth - 32));
    left = Math.max(0, (viewportWidth - contentWidth) / 2);
  }
  return Math.max(0, left - DECISION_DOCK_EDGE - DECISION_DOCK_GAP);
}

function decisionDockAnchorPassed(panel, threshold) {
  const rect = panel?.getBoundingClientRect?.();
  if (rect?.height > 0) return rect.bottom <= threshold;
  return Number(globalThis.scrollY || 0) >= threshold;
}

function placeDecisionDockTab(tab, viewportWidth) {
  const navWrap = document.querySelector(".nav .wrap");
  const sideClearance = decisionDockAvailableWidth();
  const inline = Boolean(navWrap)
    && (viewportWidth <= DECISION_DOCK_INLINE_MAX_WIDTH || sideClearance < DECISION_DOCK_TAB_CLEARANCE);
  const target = inline ? navWrap : document.body;
  if (tab.parentElement !== target) {
    if (inline) navWrap.prepend(tab);
    else document.body.appendChild(tab);
  }
  tab.classList.toggle("is-inline", inline);
}

function syncDecisionDockVisibility() {
  const dock = document.querySelector("#vm-decision-dock");
  const tab = document.querySelector("#vm-decision-dock-tab");
  if (!dock || !tab) return;
  const panel = document.querySelector("#vm-panel-decision");
  const minWidth = Number(runtime.options.decisionDockMinWidth || DECISION_DOCK_MIN_WIDTH);
  const panelMinWidth = Number(runtime.options.decisionDockPanelMinWidth || DECISION_DOCK_PANEL_MIN_WIDTH);
  const panelMaxWidth = Number(runtime.options.decisionDockPanelMaxWidth || DECISION_DOCK_PANEL_MAX_WIDTH);
  const threshold = Number(runtime.options.decisionDockThreshold || 104);
  const viewportWidth = Number(document.documentElement?.clientWidth || globalThis.innerWidth || 0);
  placeDecisionDockTab(tab, viewportWidth);
  const availableWidth = decisionDockAvailableWidth();
  const hasRoom = viewportWidth >= minWidth && availableWidth >= panelMinWidth;
  const eligible = Boolean(runtime.identity.uid || runtime.identity.role)
    && runtime.decisionDockHasItems
    && Boolean(panel)
    && decisionDockAnchorPassed(panel, threshold);
  const visible = eligible
    && !runtime.decisionDockCollapsed
    && (hasRoom || runtime.decisionDockForcedOpen);
  const tabVisible = eligible && !visible;
  const width = hasRoom
    ? Math.max(panelMinWidth, Math.min(panelMaxWidth, Math.floor(availableWidth)))
    : Math.min(panelMaxWidth, Math.max(260, viewportWidth - 58));

  dock.style.setProperty("--vm-decision-dock-width", `${width}px`);
  dock.classList.toggle("is-visible", visible);
  dock.classList.toggle("is-overlay", visible && !hasRoom);
  dock.setAttribute("aria-hidden", String(!visible));
  dock.inert = !visible;

  tab.classList.toggle("is-visible", tabVisible);
  tab.setAttribute("aria-hidden", String(!tabVisible));
  tab.setAttribute("aria-expanded", String(visible));
  tab.tabIndex = tabVisible ? 0 : -1;
}

function renderDecisionDock(countLabel, body, { hasItems = true } = {}) {
  const dock = ensureDecisionDock();
  const tab = document.querySelector("#vm-decision-dock-tab");
  const labels = decisionDockLabels();
  runtime.decisionDockHasItems = Boolean(hasItems);
  dock.setAttribute("aria-label", labels.title);
  const eyebrow = dock.querySelector("[data-vm-dock-eyebrow]");
  if (eyebrow) eyebrow.textContent = labels.eyebrow;
  const title = dock.querySelector("[data-vm-dock-title]");
  if (title) title.textContent = labels.title;
  const toggle = dock.querySelector("[data-vm-dock-toggle]");
  if (toggle) {
    toggle.textContent = "−";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Masquer le panneau vers sa languette");
  }
  const count = dock.querySelector("[data-vm-dock-count]");
  if (count) count.textContent = countLabel;
  if (tab) {
    const tabLabel = tab.querySelector("[data-vm-dock-tab-label]");
    if (tabLabel) tabLabel.textContent = labels.tab;
    const tabCount = tab.querySelector("[data-vm-dock-tab-count]");
    const compactCount = String(countLabel || "").match(/\d+\+?/)?.[0] || "";
    if (tabCount) {
      tabCount.textContent = compactCount;
      tabCount.hidden = !compactCount;
    }
    const tabAccessibleLabel = `Ouvrir ${labels.tab.toLowerCase()}${compactCount ? `, ${compactCount} élément${compactCount === "1" ? "" : "s"}` : ""}`;
    tab.setAttribute("aria-label", tabAccessibleLabel);
    tab.title = tabAccessibleLabel;
  }
  const host = dock.querySelector("[data-vm-dock-body]");
  if (host && host.dataset.signature !== body) {
    host.dataset.signature = body;
    host.innerHTML = body;
  }
  syncDecisionDockVisibility();
}

function ensureEssentialNav() {
  const wrap = document.querySelector(".nav .wrap");
  if (!wrap) return null;
  let decisions = wrap.querySelector('[data-vm-nav="decision"]');
  if (!decisions) {
    decisions = document.createElement("a");
    decisions.href = "#vm-panel-decision";
    decisions.dataset.vmNav = "decision";
    decisions.innerHTML = `${icon("decision")}<span>Décisions</span><i class="vm-attention-dot" data-vm-attention-dot hidden aria-hidden="true"></i>`;
  } else if (!decisions.querySelector("[data-vm-attention-dot]")) {
    decisions.insertAdjacentHTML("beforeend", `<i class="vm-attention-dot" data-vm-attention-dot hidden aria-hidden="true"></i>`);
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

const dashboardPanelIds = Object.freeze({
  decision: "vm-panel-decision",
  today: "vm-panel-today",
  messages: "vm-panel-message"
});

function openDashboardPanel(name) {
  const panelId = dashboardPanelIds[name];
  if (!panelId) return false;
  if (runtime.mode !== "essential") {
    runtime.explicitMode = true;
    applyMode("essential", { persist: true });
    renderDashboard(runtime.options.now instanceof Date ? runtime.options.now : new Date());
  }
  const panel = document.querySelector(`#${panelId}`);
  if (!panel) return false;
  panel.setAttribute("tabindex", "-1");
  try { globalThis.history?.replaceState?.(null, "", `#${panelId}`); } catch {}
  requestAnimationFrame(() => {
    panel.scrollIntoView?.({ behavior: "auto", block: "start" });
    try { panel.focus?.({ preventScroll: true }); } catch { panel.focus?.(); }
    if (name === "decision") scheduleAttentionReview();
  });
  return true;
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
  syncDecisionDockVisibility();
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
  const changed = Boolean(
    (search && search.value !== "")
    || (week && week.value !== "all")
    || (theme && theme.value !== "all")
  );
  if (search && search.value !== "") search.value = "";
  if (week && week.value !== "all") week.value = "all";
  if (theme && theme.value !== "all") theme.value = "all";
  if (changed) dispatchFilterRender(search, week, theme);
}

function prepareCalendarTarget(id) {
  clearCalendarFilters();
  const calendar = document.querySelector("#calendrier");
  if (calendar?.hidden) calendar.hidden = false;
  const item = planItemForId(id);
  const eventDate = inferDate(item?.dateIso || item?.date || "");
  if (eventDate && dayStart(eventDate) < dayStart(new Date())) {
    const pastToggle = document.querySelector("#past-toggle");
    // Certaines vues essentielles et certains anciens caches PWA n'exposent
    // pas le contrôle du passé. Son absence ne doit jamais interrompre
    // l'ouverture d'une carte qui est déjà rendue dans le DOM.
    if (pastToggle && pastToggle.dataset.active !== "true") pastToggle.click();
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
  return card;
}

function targetLabel(target, fallback) {
  return target.querySelector?.(".post-head h4, h2, h3, summary, b")?.textContent?.trim()
    || target.getAttribute?.("aria-label")
    || fallback
    || "Élément";
}

function targetIsMeaningfullyVisible(target) {
  const rect = target?.getBoundingClientRect?.();
  const viewportHeight = Number(globalThis.innerHeight || document.documentElement?.clientHeight || 0);
  if (!rect || !viewportHeight) return true;
  return rect.bottom > 16 && rect.top < viewportHeight * 0.72;
}

/**
 * Positionne une cible sans animation native longue. Sur les grandes cartes du
 * calendrier, un scroll smooth pouvait être interrompu par le rerendu du
 * tableau de bord et laisser l'ancienne carte (souvent le 18 juillet) visible.
 * Le gel d'ancrage reste local, bref et sans lecture ni écriture distante.
 */
async function focusAndHighlight(target, card = null) {
  const focusTarget = card || target;
  const scrollTarget = card?.querySelector?.(":scope > .post-head") || focusTarget;
  runtime.focusedCard?.classList.remove("vm-focus", "vm-target-focus");
  runtime.focusedCard = focusTarget;
  focusTarget.classList.add(card ? "vm-focus" : "vm-target-focus");
  if (!focusTarget.hasAttribute("tabindex")) {
    focusTarget.setAttribute("tabindex", "-1");
    focusTarget.dataset.vmTemporaryTabindex = "true";
  }
  try { focusTarget.focus({ preventScroll: true }); } catch { focusTarget.focus?.(); }
  const root = document.documentElement;
  root?.classList.add("vm-programmatic-navigation");
  try {
    await delay(0);
    const scrollOptions = { behavior: "auto", block: card ? "start" : "center" };
    scrollTarget.scrollIntoView?.(scrollOptions);
    await delay(24);
    if (!targetIsMeaningfullyVisible(scrollTarget)) scrollTarget.scrollIntoView?.(scrollOptions);
  } finally {
    root?.classList.remove("vm-programmatic-navigation");
  }
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
  if (card && targetType === "schedule") {
    window.dispatchEvent(new CustomEvent("cockpit:event-context-request", {
      detail: { eventId: targetId, source: "navigation" }
    }));
  }
  let focusTarget = card || target;
  if (card && mediaId) {
    const media = [...card.querySelectorAll(".cockpit-media-card[data-media-id]")]
      .find((candidate) => candidate.dataset.mediaId === mediaId);
    if (media) {
      media.querySelector("details.cockpit-media-info")?.setAttribute("open", "");
      focusTarget = media;
    }
  }
  await focusAndHighlight(focusTarget, focusTarget === card ? card : null);
  const label = targetLabel(card || target, targetId);
  announce(`Élément ouvert : ${label}. Le brief et les médias sont prêts à être consultés.`);
  clearNavigationError();
  return true;
}

function dataMillis(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function messageSeenStorageKey(identity = runtime.identity) {
  const owner = identity.uid ? `uid:${identity.uid}` : identity.role ? `role:${identity.role}` : "device";
  return `${MESSAGE_SEEN_PREFIX}:${owner}`;
}

function seenMessageVersions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(messageSeenStorageKey()) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function messageWasSeen(commentId, version) {
  if (!commentId) return false;
  const seen = seenMessageVersions();
  return Object.prototype.hasOwnProperty.call(seen, commentId) && dataMillis(seen[commentId]) >= dataMillis(version);
}

function markMessageSeen(commentId, version) {
  if (!commentId) return;
  try {
    const seen = seenMessageVersions();
    seen[commentId] = Math.max(dataMillis(seen[commentId]), dataMillis(version));
    const compact = Object.fromEntries(Object.entries(seen)
      .sort((left, right) => dataMillis(right[1]) - dataMillis(left[1]))
      .slice(0, 250));
    localStorage.setItem(messageSeenStorageKey(), JSON.stringify(compact));
  } catch { /* La lecture reste fonctionnelle si le stockage local est bloqué. */ }
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
      id: message.dataset.commentId || "",
      text: message.querySelector("p")?.textContent?.trim() || "",
      updatedAt: dataMillis(message.dataset.updatedAt || message.dataset.createdAt)
    }))
    .filter((message) => message.id && message.text && !messageWasSeen(message.id, message.updatedAt))
    .sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
}

function mediaStateFor(card) {
  const mediaCards = [...card.querySelectorAll(".cockpit-media-card")];
  const isSelected = (media) => media.classList.contains("is-final")
    || media.dataset.mediaSelectedFinal === "true"
    || media.dataset.mediaCommunicationsSelected === "true"
    || media.dataset.mediaDirectionSelected === "true";
  const candidates = mediaCards.filter((media) => {
    const stage = media.dataset.mediaStage || "";
    // Une photo source ou une référence peut être retenue telle quelle comme
    // visuel final. Dès qu'un rôle la choisit, elle participe donc au passage
    // de relais même si son étiquette documentaire demeure « source ».
    return !["source", "reference"].includes(stage) || isSelected(media);
  });
  return {
    count: candidates.length,
    selectedCount: candidates.filter((media) => media.classList.contains("is-final") || media.dataset.mediaSelectedFinal === "true").length,
    communicationsSelected: candidates.some((media) => media.dataset.mediaCommunicationsSelected === "true"),
    directionSelected: candidates.some((media) => media.dataset.mediaDirectionSelected === "true"),
    latestUpdate: candidates.reduce((latest, media) => Math.max(latest, dataMillis(media.dataset.mediaUpdatedAt)), 0)
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

function personalActionItemModels(identity = runtime.identity) {
  const source = document.querySelector("#cockpit-action-item-source");
  return [...(source?.querySelectorAll("[data-action-item-id]") || [])].map((item) => ({
    id: item.dataset.actionItemId || "",
    assigneeUid: item.dataset.actionAssigneeUid || "",
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
  })).filter((item) => item.id && item.targetId && notificationRecipientMatches(identity, item));
}

function roleDecisionForEvent(event, role, tasks = []) {
  const latestTask = [...tasks].sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
  const baseUpdatedAt = Math.max(event.workflowUpdatedAt, event.editorialUpdatedAt, event.media.latestUpdate, event.incomingMessage?.updatedAt || 0);
  const mediaUpdatedAfterWorkflow = event.media.latestUpdate > event.workflowUpdatedAt;

  // Les tâches Firestore sont créées par la direction et destinées aux
  // communications. Elles ne sont jamais montrées à la direction comme si
  // elles lui appartenaient. Une publication terminée reste archivée mais ne
  // peut plus être ressuscitée par une ancienne tâche technique.
  if (role === "admin" && latestTask && !event.complete && !event.setAside) {
    return {
      ...event,
      taskId: latestTask.id,
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
    if (event.item?.requiresContactOwnership === true && ["proposal", "content_review", "changes_requested"].includes(event.stage)) {
      return {
        ...event,
        action: event.stage === "content_review"
          ? "Attribuer le premier contact et la coordination, puis valider le texte"
          : "Organiser le portrait : choisir les personnes et attribuer le premier contact",
        whyNow: event.item.coordinationLabel || "Une vraie personne, son accord et un responsable de coordination sont requis avant d’avancer.",
        updatedAt: baseUpdatedAt
      };
    }
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
  // Une nouveauté reste bien visible, sans passer devant une validation de
  // publication réellement urgente dans les prochaines 48 heures.
  if (decision.actionType === "content_notice") return { rank: 1, dateValue: 0, className: "notice" };
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

function roleDecisionModels(events, identity, now) {
  const role = identity.role;
  const tasks = role === "admin" ? pendingTaskModels(role) : [];
  const personalActions = personalActionItemModels(identity);
  const personalEventIds = new Set(personalActions.filter((item) => {
    if (item.targetType !== "schedule") return false;
    const event = events.find((candidate) => candidate.id === item.targetId);
    return event && !event.complete;
  }).map((item) => item.targetId));
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
    if (event?.complete) return null;
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
      actionType: item.actionType,
      title: event?.title || item.title,
      date,
      dateLabel: event?.dateLabel || item.eventDateIso,
      theme: event?.theme || (item.actionType === "content_notice" ? "Nouveauté dans le cockpit" : "Décision personnelle"),
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

function completionButton(event) {
  const accessibleTitle = escapeHtml(`Marquer « ${event.action || event.title || "cette action"} » comme fait`);
  if (event.actionItemId) {
    return `<button type="button" class="vm-complete-action" data-vm-complete-action-item="${escapeHtml(event.actionItemId)}" aria-label="${accessibleTitle}" title="Classer cette action comme accomplie; elle restera dans l’historique."><span aria-hidden="true">✓</span> C’est fait</button>`;
  }
  if (event.taskId && runtime.identity.role === "admin") {
    return `<button type="button" class="vm-complete-action" data-complete-task="${escapeHtml(event.taskId)}" aria-label="${accessibleTitle}" title="Classer cette tâche comme accomplie; elle restera dans l’historique."><span aria-hidden="true">✓</span> C’est fait</button>`;
  }
  return "";
}

function linkButton(event, label = "Ouvrir") {
  const completion = completionButton(event);
  if (event.taskId) {
    const taskTargetId = event.targetId || event.id;
    return `<div class="vm-event-actions"><button type="button" class="vm-open" data-vm-target="${escapeHtml(taskTargetId)}" data-vm-entity-type="${escapeHtml(event.targetType || "schedule")}" data-vm-task="${escapeHtml(event.taskId)}">${escapeHtml(label)}<span aria-hidden="true">→</span></button>${completion}</div>`;
  }
  const targetId = event.targetId || event.id;
  const messageId = event.messageId || event.incomingMessage?.id || "";
  const messageVersion = event.messageVersion || event.incomingMessage?.updatedAt || 0;
  const notice = event.actionType === "content_notice" && event.actionItemId
    ? ` data-vm-action-item-id="${escapeHtml(event.actionItemId)}" data-vm-action-type="content_notice"`
    : "";
  const open = `<button type="button" class="vm-open" data-vm-target="${escapeHtml(targetId)}" data-vm-entity-type="${escapeHtml(event.targetType || "schedule")}"${event.mediaId ? ` data-vm-media="${escapeHtml(event.mediaId)}"` : ""}${messageId ? ` data-vm-message-id="${escapeHtml(messageId)}" data-vm-message-version="${dataMillis(messageVersion)}"` : ""}${notice}>${escapeHtml(event.actionType === "content_notice" ? "Voir la nouveauté" : label)}<span aria-hidden="true">→</span></button>`;
  return `<div class="vm-event-actions">${open}${completion}</div>`;
}

function estimatedDecisionMinutes(event, role) {
  const assignedEstimate = role === "director" ? Number(event.item?.coordinationDecisionMinutesAnnie) : 0;
  if (Number.isInteger(assignedEstimate) && assignedEstimate > 0) return assignedEstimate;
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
  const isNotice = event.actionType === "content_notice";
  const estimate = estimatedDecisionMinutes(event, runtime.identity.role);
  return `<article class="vm-event${event.urgency?.className ? ` priority-${event.urgency.className}` : ""}">
    <div>${isNotice ? `<span class="vm-event-date vm-new-badge">★ Nouveauté</span>` : `<span class="vm-event-date">${escapeHtml(relativeDateLabel(event.date, now))}</span><span class="vm-time-estimate" aria-label="Durée approximative ${estimate} minutes">${formatEstimatedMinutes(estimate)}</span>`}<h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.theme)}${showAction ? ` · ${escapeHtml(event.action)}` : ""}</p></div>
    ${showReason ? `<span class="vm-why-now"><b>${isNotice ? "À découvrir" : "Pourquoi maintenant"}</b>${escapeHtml(event.whyNow || "Action à traiter")}</span>` : ""}
    ${linkButton(event)}
  </article>`;
}

function gateIsDone(card, gate) {
  return Boolean(card.querySelector(`[data-gate="${gate}"][aria-pressed="true"], [data-gate="${gate}"].done`));
}

function synchronizeCardDetails(card, expanded) {
  card?.querySelectorAll?.("details").forEach((details) => {
    if (expanded) details.setAttribute("open", "");
    else details.removeAttribute("open");
  });
}

function setCardExpanded(card, expanded, { persist = true } = {}) {
  if (!card) return;
  const isExpanded = Boolean(expanded);
  card.classList.toggle("vm-expanded", isExpanded);
  synchronizeCardDetails(card, isExpanded);
  if (persist) writeCardExpansion(card.dataset.itemId, isExpanded);
  const toggle = card.querySelector(":scope > .vm-card-summary [data-vm-card-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.textContent = isExpanded ? "− Réduire" : "+ Ouvrir";
    const title = card.querySelector(":scope > .post-head h4")?.textContent?.trim() || "cette publication";
    toggle.setAttribute("aria-label", `${isExpanded ? "Réduire" : "Ouvrir"} le brief complet — ${title}`);
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

    const expansionOwner = identityStorageOwner();
    if (card.dataset.vmExpansionOwner !== expansionOwner) {
      card.dataset.vmExpansionOwner = expansionOwner;
      setCardExpanded(card, readCardExpansion(card.dataset.itemId), { persist: false });
    }

    const action = card.querySelector("[data-workflow-actions] button:not(:disabled)")?.textContent?.trim()
      || (card.classList.contains("workflow-complete") ? "Publication terminée" : "Ouvrir pour poursuivre");
    const state = {
      content: gateIsDone(card, "content") ? "done" : card.querySelector('[data-gate="content"].current') ? "active" : "pending",
      media: gateIsDone(card, "media") ? "done" : card.querySelector('[data-gate="media"].current') ? "active" : "pending",
      publication: gateIsDone(card, "publication") ? "done" : card.querySelector('[data-gate="publication"].current') ? "active" : "pending"
    };
    const expanded = card.classList.contains("vm-expanded");
    synchronizeCardDetails(card, expanded);
    configureCardHeaderToggle(card, head, expanded);
    const signature = JSON.stringify({ action, state, expanded });
    if (summary.dataset.signature === signature) return;
    summary.dataset.signature = signature;
    const stateLabels = { done: "terminé", active: "en cours", pending: "en attente" };
    const step = (label, status) => `<span class="state-${status}" aria-label="${label} : ${stateLabels[status]}" title="${label} : ${stateLabels[status]}"><i aria-hidden="true">${status === "done" ? "✓" : "●"}</i>${label}</span>`;
    summary.innerHTML = `
      <div class="vm-card-next"><small>Prochaine étape</small><b>${escapeHtml(action)}</b></div>
      <div class="vm-card-progress" aria-label="Avancement du texte, du média et de la publication">
        ${step("Texte", state.content)}${step("Média", state.media)}${step("Publication", state.publication)}
      </div>
      <button type="button" data-vm-card-toggle aria-expanded="${expanded}" aria-label="${expanded ? "Réduire" : "Ouvrir"} le brief complet — ${escapeHtml(head.querySelector("h4")?.textContent?.trim() || "cette publication")}">${expanded ? "− Réduire" : "+ Ouvrir"}</button>`;
  });
}

function messageModels() {
  const events = new Map(eventModels().map((model) => [model.id, model]));
  return [...document.querySelectorAll(".post[data-item-id] [data-comment-thread] .cockpit-message.other:not(.handled)")]
    .map((message, index) => {
      const card = message.closest(".post[data-item-id]");
      const event = card ? events.get(card.dataset.itemId) : null;
      return {
        id: message.dataset.commentId || String(index),
        event,
        author: message.querySelector("header b")?.textContent?.replace(/^💬\s*/, "")?.trim() || "Message",
        when: message.querySelector("header span")?.textContent?.trim() || "",
        text: message.querySelector("p")?.textContent?.trim() || "",
        createdAt: Number(message.dataset.createdAt || 0),
        updatedAt: dataMillis(message.dataset.updatedAt || message.dataset.createdAt)
      };
    }).filter((message) => message.event && message.text && !messageWasSeen(message.id, message.updatedAt))
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
  const workflowSync = document.body.dataset.workflowSync || "server";
  const cachedOfflineState = workflowSync === "cache"
    && (document.body.classList.contains("cockpit-safe-mode") || globalThis.navigator?.onLine === false);
  const decisionsAreCurrent = workflowSync === "server" || cachedOfflineState;
  const allDecisions = decisionsAreCurrent ? roleDecisionModels(events, runtime.identity, now) : [];
  const pageSize = queuePageSize();
  const queueOwner = notificationOwnerKey(runtime.identity);
  if (runtime.queueOwner !== queueOwner) {
    runtime.queueOwner = queueOwner;
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
  const offlineNotice = cachedOfflineState
    ? `<p class="vm-queue-offline" role="status">Mode hors ligne · décisions provenant du dernier cache de cet appareil.</p>`
    : "";
  const decisionsBody = !decisionsAreCurrent
    ? `<div class="vm-all-clear vm-syncing" role="status"><b>Synchronisation en cours…</b><span>Le cockpit confirme vos décisions avec le serveur avant de les afficher. Les éléments déjà terminés ne réapparaîtront pas depuis un ancien cache.</span></div>`
    : decisions.length
    ? offlineNotice + decisions.map((event) => compactEvent(event, now, { showReason: true })).join("") + queueFooter
    : offlineNotice + `<div class="vm-all-clear"><b>Tout est à jour.</b><span>Aucune décision n’est requise pour le moment.</span></div>`;
  const weekBody = nextWeek.length
    ? nextWeek.map((event) => compactEvent(event, now, { showAction: false })).join("")
    : empty("Aucun événement au cours des sept prochains jours.");
  const messagesBody = messages.length
    ? messages.map((message) => `<article class="vm-message"><div><span>${escapeHtml(message.author)}${message.when ? ` · ${escapeHtml(message.when)}` : ""}</span><h3>${escapeHtml(message.event.title)}</h3><p>${escapeHtml(message.text)}</p></div>${linkButton({ ...message.event, messageId: message.id, messageVersion: message.updatedAt }, "Répondre")}</article>`).join("")
    : empty("Aucun message actif dans les événements visibles.");

  grid.innerHTML = [
    panel("decision", "Décisions qui m’attendent", decisionsAreCurrent ? `${allDecisions.length}${remoteMore ? "+" : ""} pour vous` : "Synchronisation", decisionsBody, "vm-decisions"),
    panel("week", "Les sept prochains jours", `${nextWeek.length} événement${nextWeek.length > 1 ? "s" : ""}`, weekBody, "vm-week"),
    panel("today", "Aujourd’hui", `${today.length} événement${today.length > 1 ? "s" : ""}`, todayBody, "vm-today vm-compact"),
    panel("message", "Messages actifs", `${messages.length} récent${messages.length > 1 ? "s" : ""}`, messagesBody, "vm-messages vm-compact")
  ].join("");
  renderDecisionDock(
    decisionsAreCurrent ? `${allDecisions.length}${remoteMore ? "+" : ""} pour vous` : "Synchronisation",
    decisionsBody,
    { hasItems: !decisionsAreCurrent || allDecisions.length > 0 || remoteMore || Boolean(remoteError) }
  );
  ensureAttentionControls();
  // Aucun listener supplémentaire : la notification réutilise exactement la file
  // personnelle que ce rendu vient déjà de calculer.
  syncAttentionSnapshot(allDecisions, { current: workflowSync === "server" });

  enhanceCardSummaries();
  const messageBadge = ensureEssentialNav()?.querySelector("[data-vm-message-count]");
  if (messageBadge) {
    messageBadge.textContent = String(messages.length);
    messageBadge.hidden = messages.length === 0;
    messageBadge.setAttribute("aria-label", `${messages.length} message${messages.length > 1 ? "s" : ""} actif${messages.length > 1 ? "s" : ""}`);
  }
}

function clearContentNoticeDwell() {
  clearTimeout(runtime.contentNoticeTimer);
  runtime.contentNoticeTimer = 0;
  runtime.contentNoticeTarget?.classList.remove("vm-new-content-focus");
  runtime.contentNoticeTarget = null;
}

function isMeaningfullyVisible(target) {
  if (!target || document.visibilityState === "hidden") return false;
  const rect = target.getBoundingClientRect();
  const viewportHeight = globalThis.innerHeight || document.documentElement.clientHeight || 0;
  const viewportWidth = globalThis.innerWidth || document.documentElement.clientWidth || 0;
  if (rect.height <= 0 || rect.width <= 0 || viewportHeight <= 0 || viewportWidth <= 0) return false;
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
  const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
  return visibleHeight >= Math.min(120, rect.height * .35) && visibleWidth >= Math.min(160, rect.width * .35);
}

function scheduleContentNoticeSeen({ type, id, actionItemId }) {
  clearContentNoticeDwell();
  const target = findEntityTarget(type, id);
  if (!target || runtime.identity.role !== "director" || !actionItemId) return;
  runtime.contentNoticeTarget = target;
  target.classList.add("vm-new-content-focus");
  const dwell = Number.isFinite(Number(runtime.options.contentNoticeDwellMs))
    ? Math.max(0, Number(runtime.options.contentNoticeDwellMs))
    : CONTENT_NOTICE_DWELL_MS;
  runtime.contentNoticeTimer = setTimeout(() => {
    const viewed = runtime.contentNoticeTarget === target && isMeaningfullyVisible(target);
    clearContentNoticeDwell();
    if (viewed) window.dispatchEvent(new CustomEvent("cockpit:content-notice-seen", { detail: { actionItemId, sourceType: type, sourceId: id } }));
  }, dwell);
}

async function runNavigation(control, target) {
  if (!control || control.dataset.vmNavigating === "true") return;
  const original = control.innerHTML;
  control.dataset.vmNavigating = "true";
  control.setAttribute("aria-busy", "true");
  control.disabled = true;
  control.textContent = "Ouverture…";
  try {
    const opened = await navigateToEntity(target);
    if (opened && control.dataset.vmMessageId) {
      markMessageSeen(control.dataset.vmMessageId, control.dataset.vmMessageVersion);
      scheduleRender();
    }
    if (opened && control.dataset.vmActionType === "content_notice") {
      scheduleContentNoticeSeen({ type: target.type, id: target.id, actionItemId: control.dataset.vmActionItemId });
    }
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
      renderDashboard(runtime.options.now instanceof Date ? runtime.options.now : new Date());
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
  runtime.renderTimer = setTimeout(() => renderDashboard(runtime.options.now instanceof Date ? runtime.options.now : new Date()), 80);
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
    runtime.queueOwner = "";
    runtime.queueVisibleCount = 0;
    runtime.decisionDockCollapsed = readDecisionDockPreference(next);
    runtime.decisionDockForcedOpen = false;
    hydrateAttentionPreference(next);
  }
  if (changed && !runtime.explicitMode) {
    applyMode(readPreference(next) || defaultMode(next));
  }
}

function handleClick(event) {
  const markSeen = event.target.closest("[data-vm-attention-seen]");
  if (markSeen) {
    markCurrentAttentionSeen();
    return;
  }
  const attentionToggle = event.target.closest("[data-vm-attention-toggle]");
  if (attentionToggle) {
    toggleAttentionPreference();
    return;
  }
  const systemNotificationToggle = event.target.closest("[data-vm-system-notification]");
  if (systemNotificationToggle) {
    void toggleSystemNotifications(systemNotificationToggle);
    return;
  }
  const modeButton = event.target.closest("[data-view-mode]");
  if (modeButton && VALID_MODES.has(modeButton.dataset.viewMode)) {
    runtime.explicitMode = true;
    applyMode(modeButton.dataset.viewMode, { persist: true });
    if (runtime.mode === "essential") renderDashboard(runtime.options.now instanceof Date ? runtime.options.now : new Date());
    return;
  }
  const dockToggle = event.target.closest("[data-vm-dock-toggle]");
  if (dockToggle) {
    runtime.decisionDockCollapsed = true;
    runtime.decisionDockForcedOpen = false;
    writeDecisionDockPreference(true);
    syncDecisionDockVisibility();
    const tab = document.querySelector("#vm-decision-dock-tab");
    try { tab?.focus?.({ preventScroll: true }); } catch { tab?.focus?.(); }
    return;
  }
  const dockTab = event.target.closest("[data-vm-dock-tab]");
  if (dockTab) {
    runtime.decisionDockCollapsed = false;
    runtime.decisionDockForcedOpen = true;
    writeDecisionDockPreference(false);
    syncDecisionDockVisibility();
    scheduleAttentionReview();
    const close = document.querySelector("[data-vm-dock-toggle]");
    try { close?.focus?.({ preventScroll: true }); } catch { close?.focus?.(); }
    return;
  }
  const dockReturn = event.target.closest("[data-vm-dock-return]");
  if (dockReturn) {
    const panel = document.querySelector("#vm-panel-decision");
    panel?.scrollIntoView?.({ behavior: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "start" });
    try { panel?.focus?.({ preventScroll: true }); } catch { panel?.focus?.(); }
    scheduleAttentionReview();
    return;
  }
  const dashboardNav = event.target.closest("[data-vm-nav]");
  if (dashboardNav && dashboardPanelIds[dashboardNav.dataset.vmNav]) {
    event.preventDefault();
    openDashboardPanel(dashboardNav.dataset.vmNav);
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
  runtime.decisionDockCollapsed = readDecisionDockPreference(runtime.identity);
  runtime.decisionDockForcedOpen = false;
  hydrateAttentionPreference(runtime.identity);
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
    runtime.queueOwner = "";
    runtime.queueVisibleCount = 0;
    runtime.navigationToken += 1;
    clearContentNoticeDwell();
    clearAttentionReview();
    runtime.attentionCurrent = false;
    runtime.attentionUnseen = false;
    updateAppAttentionBadge(false);
    document.documentElement.classList.remove("cockpit-has-unseen");
    document.querySelector("#cockpit-view-mode-toggle")?.remove();
    document.querySelector("#cockpit-essential-dashboard")?.remove();
    document.querySelector("#vm-decision-dock")?.remove();
    document.querySelector("#vm-decision-dock-tab")?.remove();
    document.querySelectorAll("[data-vm-nav]").forEach((node) => node.remove());
  });
  listen(window, "cockpit:data-updated", () => update());
  listen(window, "cockpit:card-expansion-request", (event) => {
    const card = cardForId(String(event.detail?.itemId || ""));
    if (card) {
      setCardExpanded(card, event.detail?.expanded !== false);
      event.preventDefault();
    }
  });
  listen(window, "pageshow", () => update());
  listen(window, "scroll", () => {
    syncDecisionDockVisibility();
    scheduleAttentionReview();
  }, { passive: true });
  listen(window, "resize", () => {
    runtime.decisionDockForcedOpen = false;
    syncDecisionDockVisibility();
    scheduleAttentionReview();
  }, { passive: true });
  listen(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") clearAttentionReview();
    else scheduleAttentionReview();
  });
  if (globalThis.navigator?.serviceWorker?.addEventListener) {
    listen(globalThis.navigator.serviceWorker, "message", (event) => {
      if (event.data?.type === "cockpit-open-attention") void openAttentionFromSystemNotification();
    });
  }

  update();
  if (attentionLaunchRequested()) setTimeout(() => void openAttentionFromSystemNotification(), 0);
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
  renderDashboard(runtime.options.now instanceof Date ? runtime.options.now : new Date());
  observeDataDom();
}

/** Retire uniquement les éléments et écouteurs appartenant à ce module. */
export function destroy() {
  clearTimeout(runtime.renderTimer);
  clearTimeout(runtime.focusTimer);
  clearContentNoticeDwell();
  clearAttentionReview();
  updateAppAttentionBadge(false);
  runtime.observer?.disconnect();
  runtime.listeners.splice(0).forEach((remove) => remove());
  document.querySelector("#cockpit-view-mode-toggle")?.remove();
  document.querySelector("#cockpit-essential-dashboard")?.remove();
  document.querySelector("#vm-decision-dock")?.remove();
  document.querySelector("#vm-decision-dock-tab")?.remove();
  document.querySelectorAll("[data-vm-nav]").forEach((node) => node.remove());
  document.querySelectorAll(".vm-card-summary").forEach((node) => node.remove());
  document.querySelector(`link[data-module="${MODULE_ID}"]`)?.remove();
  document.documentElement.removeAttribute("data-cockpit-view");
  document.documentElement.classList.remove("cockpit-has-unseen");
  document.body.classList.remove("cockpit-view-essential", "cockpit-view-complete");
  runtime.initialized = false;
  runtime.explicitMode = false;
  runtime.observer = null;
  runtime.focusedCard = null;
  runtime.navigationToken += 1;
  runtime.queueOwner = "";
  runtime.queueVisibleCount = 0;
  runtime.decisionDockForcedOpen = false;
  runtime.decisionDockHasItems = false;
  runtime.attentionCurrent = false;
  runtime.attentionUnseen = false;
  runtime.attentionTokens = [];
  runtime.attentionSignature = "";
}

// Autonome lorsque chargé directement; init() reste exporté pour les tests et
// les intégrations qui souhaitent fournir explicitement l'uid et le rôle.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init(), { once: true });
} else {
  init();
}
