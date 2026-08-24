import { setPersonalActionItemState, subscribePersonalActionItems } from "./firebase-client.js?v=20260824-b67";

let controller = null;
let activeProfile = null;
let eventsReady = false;
const seenWrites = new Set();

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
const millis = (value) => value?.toMillis?.() || value?.toDate?.()?.valueOf?.() || Number(value || 0) || 0;

function sourceNode() {
  let source = document.querySelector("#cockpit-action-item-source");
  if (source) return source;
  source = document.createElement("section");
  source.id = "cockpit-action-item-source";
  source.hidden = true;
  source.setAttribute("aria-hidden", "true");
  document.body.appendChild(source);
  return source;
}

function render(items, meta = {}) {
  const source = sourceNode();
  source.dataset.ready = "true";
  source.dataset.uid = activeProfile?.uid || "";
  source.dataset.role = activeProfile?.role || "";
  source.dataset.hasMore = String(Boolean(meta.hasMore));
  source.dataset.loading = String(Boolean(meta.loading));
  source.dataset.error = String(meta.error || "").slice(0, 500);
  source.innerHTML = (Array.isArray(items) ? items : []).map((item) => `<article data-action-item-id="${esc(item.id)}" data-action-assignee-uid="${esc(item.assigneeUid || "")}" data-action-assignee-role="${esc(item.assigneeRole || "")}" data-action-target-type="${esc(item.sourceType || "schedule")}" data-action-target="${esc(item.sourceId || "")}" data-action-media="${esc(item.mediaId || "")}" data-action-type="${esc(item.actionType || "")}" data-action-priority="${Number.isInteger(item.priorityKey) ? item.priorityKey : 9999}" data-action-date="${esc(item.eventDateIso || "9999-12-31")}" data-action-updated-at="${millis(item.updatedAt || item.createdAt)}"><b>${esc(item.title || "Décision à prendre")}</b><p>${esc(item.message || "")}</p></article>`).join("");
  dispatchEvent(new CustomEvent("cockpit:action-items-updated", { detail: { count: items?.length || 0, ...meta } }));
}

function personalActionNode(actionItemId) {
  return [...(sourceNode().querySelectorAll("[data-action-item-id]") || [])]
    .find((candidate) => candidate.dataset.actionItemId === actionItemId) || null;
}

function announce(message) {
  const announcer = document.querySelector("#cockpit-announcer");
  if (announcer) announcer.textContent = message;
}

async function completePersonalAction(control) {
  const actionItemId = String(control?.dataset?.vmCompleteActionItem || "");
  if (!activeProfile?.uid || !["director", "admin"].includes(activeProfile.role)
    || !/^[A-Za-z0-9_-]{3,180}$/.test(actionItemId) || seenWrites.has(actionItemId)) return;
  const item = personalActionNode(actionItemId);
  const belongsToProfile = item
    && item.dataset.actionAssigneeUid === activeProfile.uid
    && item.dataset.actionAssigneeRole === activeProfile.role;
  if (!belongsToProfile) {
    announce("Cette action n’appartient pas à votre file personnelle.");
    window.dispatchEvent(new CustomEvent("cockpit:action-item-completion-error", { detail: { actionItemId } }));
    return;
  }
  seenWrites.add(actionItemId);
  control.disabled = true;
  control.setAttribute("aria-busy", "true");
  try {
    await setPersonalActionItemState(actionItemId, "done", activeProfile);
    announce("Action marquée comme faite. Elle quitte votre file et reste conservée dans l’historique.");
    window.dispatchEvent(new CustomEvent("cockpit:action-item-completed", { detail: { actionItemId } }));
  } catch (error) {
    console.warn("L’action reste dans la file : son classement n’a pas pu être confirmé.", error);
    announce(error?.message || "Cette action n’a pas pu être classée comme faite.");
    window.dispatchEvent(new CustomEvent("cockpit:action-item-completion-error", { detail: { actionItemId } }));
    control.disabled = false;
  } finally {
    control.removeAttribute("aria-busy");
    seenWrites.delete(actionItemId);
  }
}

function bindEvents() {
  if (eventsReady) return;
  eventsReady = true;
  window.addEventListener("cockpit:load-more-action-items", () => {
    if (document.querySelector("#cockpit-action-item-source")?.dataset.error && activeProfile) {
      setupPersonalActionItems(activeProfile, true);
      return;
    }
    controller?.loadMore?.();
  });
  window.addEventListener("cockpit:action-item-state-saved", (event) => {
    controller?.setLocalState?.(event.detail?.id || "", event.detail?.state || "pending");
  });
  document.addEventListener("click", (event) => {
    const control = event.target?.closest?.("[data-vm-complete-action-item]");
    if (control) void completePersonalAction(control);
  });
  window.addEventListener("cockpit:content-notice-seen", async (event) => {
    const actionItemId = String(event.detail?.actionItemId || "");
    if (!activeProfile?.uid || activeProfile.role !== "director" || !/^[A-Za-z0-9_-]{3,180}$/.test(actionItemId) || seenWrites.has(actionItemId)) return;
    const item = [...(sourceNode().querySelectorAll("[data-action-item-id]") || [])]
      .find((candidate) => candidate.dataset.actionItemId === actionItemId);
    if (!item || item.dataset.actionType !== "content_notice" || item.dataset.actionAssigneeRole !== "director") return;
    seenWrites.add(actionItemId);
    try {
      await setPersonalActionItemState(actionItemId, "done", activeProfile);
      const announcer = document.querySelector("#cockpit-announcer");
      if (announcer) announcer.textContent = "Nouveauté consultée. Elle est retirée de votre file personnelle.";
    } catch (error) {
      console.warn("La nouveauté reste dans la file : son état vu n’a pas pu être confirmé.", error);
      window.dispatchEvent(new CustomEvent("cockpit:content-notice-error", { detail: { actionItemId } }));
    } finally {
      seenWrites.delete(actionItemId);
    }
  });
}

export function setupPersonalActionItems(profile, configured = true) {
  clearPersonalActionItems();
  activeProfile = profile;
  bindEvents();
  if (!configured || !["director", "admin"].includes(profile?.role)) return;
  sourceNode();
  try {
    controller = subscribePersonalActionItems(profile, render, (error) => console.warn("File personnelle Firestore indisponible; repli local conservé.", error));
  } catch (error) {
    render([], { error: error?.message || "File personnelle indisponible." });
  }
}

export function clearPersonalActionItems() {
  controller?.unsubscribe?.();
  controller = null;
  activeProfile = null;
  document.querySelector("#cockpit-action-item-source")?.remove();
}
