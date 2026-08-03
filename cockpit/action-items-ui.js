import { setPersonalActionItemState, subscribePersonalActionItems } from "./firebase-client.js?v=20260803-b52";

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
