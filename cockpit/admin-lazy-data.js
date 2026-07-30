import { subscribeAuditLogs, subscribeCockpitFeedback } from "./firebase-client.js?v=20260730-b46";
import { clearAdminActivitySummary, renderAdminActivitySummary, setAdminActivityLogs } from "./admin-activity-summary.js?v=20260730-b46";

let auditUnsubscribe = null;
let feedbackUnsubscribe = null;
let stopTimer = null;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);

function renderLogs(logs) {
  const list = document.querySelector("#cockpit-log-list");
  if (!list) return;
  list.innerHTML = logs.length ? logs.map((log) => {
    const when = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString("fr-CA") : "date en attente";
    return `<div class="cockpit-log"><b>${esc(when)} · ${esc(log.action || "modification")}</b><span>section: ${esc(log.sectionId || "—")} · utilisateur: ${esc(log.userLabel || log.userUid || "—")}</span></div>`;
  }).join("") : "<p>Aucun journal accessible pour le moment.</p>";
  setAdminActivityLogs(logs);
}

export function startAdminLazyData({ enabled, onFeedback, onError }) {
  if (!enabled) return;
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  renderAdminActivitySummary();
  auditUnsubscribe ||= subscribeAuditLogs(renderLogs, (error) => onError?.("journal", error));
  feedbackUnsubscribe ||= subscribeCockpitFeedback(onFeedback, (error) => onError?.("rétroactions", error));
}

export function scheduleAdminLazyDataStop(delayMs = 15000) {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    auditUnsubscribe?.();
    feedbackUnsubscribe?.();
    auditUnsubscribe = null;
    feedbackUnsubscribe = null;
    stopTimer = null;
  }, delayMs);
}

export function clearAdminLazyData() {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  auditUnsubscribe?.();
  feedbackUnsubscribe?.();
  auditUnsubscribe = null;
  feedbackUnsubscribe = null;
  clearAdminActivitySummary();
}
