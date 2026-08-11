import { fetchCompletedActionTasksPage } from "./firebase-client.js?v=20260811-b59";
import { renderCompletedActionTaskCard } from "./task-progress-ui.js?v=20260811-b59";

const historyState = {
  profile: null,
  items: [],
  cursor: null,
  hasMore: true,
  loading: false,
  initialized: false,
  error: "",
  readCount: 0
};

export function completedTaskHistoryMarkup() {
  return `<details id="cockpit-completed-task-history"><summary>Historique des tâches traitées</summary><div class="cockpit-completed-task-body"><p class="cockpit-history-status" data-completed-history-status>Ouvrez cette section pour charger les dernières tâches traitées.</p><div id="cockpit-completed-task-list"></div><div class="cockpit-history-actions"><button type="button" data-load-more-completed hidden>Charger la suite</button><button type="button" data-retry-completed hidden>Réessayer</button></div></div></details>`;
}

const timestampMillis = (value) => value?.toMillis?.() || value?.toDate?.()?.valueOf?.() || Number(value || 0) || 0;
const taskWhen = (task) => (task.updatedAt?.toDate ? task.updatedAt.toDate().toLocaleString("fr-CA") : task.createdAt?.toDate ? task.createdAt.toDate().toLocaleString("fr-CA") : "date en attente");

function resetState({ keepProfile = true } = {}) {
  if (!keepProfile) historyState.profile = null;
  historyState.items = [];
  historyState.cursor = null;
  historyState.hasMore = true;
  historyState.loading = false;
  historyState.initialized = false;
  historyState.error = "";
  historyState.readCount = 0;
  render();
}

function render() {
  const list = document.querySelector("#cockpit-completed-task-list");
  const status = document.querySelector("[data-completed-history-status]");
  const loadMore = document.querySelector("[data-load-more-completed]");
  const retry = document.querySelector("[data-retry-completed]");
  if (!list || !status || !loadMore || !retry) return;
  list.innerHTML = historyState.items.map((task) => renderCompletedActionTaskCard({
    task,
    when:taskWhen(task),
    updatedAt:timestampMillis(task.updatedAt || task.createdAt)
  })).join("");
  if (historyState.loading) status.textContent = historyState.items.length ? "Chargement de la suite…" : "Chargement des dernières tâches traitées…";
  else if (historyState.error) status.textContent = `Historique momentanément indisponible : ${historyState.error}`;
  else if (!historyState.initialized) status.textContent = "Ouvrez cette section pour charger les dernières tâches traitées.";
  else if (!historyState.items.length) status.textContent = "Aucune tâche traitée dans cet historique.";
  else if (historyState.hasMore) status.textContent = `${historyState.items.length} tâche${historyState.items.length > 1 ? "s" : ""} chargée${historyState.items.length > 1 ? "s" : ""}. La suite reste disponible à la demande.`;
  else status.textContent = `Fin de l’historique · ${historyState.items.length} tâche${historyState.items.length > 1 ? "s" : ""} chargée${historyState.items.length > 1 ? "s" : ""}.`;
  loadMore.hidden = historyState.loading || Boolean(historyState.error) || !historyState.hasMore || !historyState.items.length;
  retry.hidden = historyState.loading || !historyState.error;
}

async function load({ reset = false } = {}) {
  if (historyState.loading || historyState.profile?.role !== "admin") return;
  if (reset) resetState();
  historyState.loading = true;
  historyState.error = "";
  render();
  try {
    const page = await fetchCompletedActionTasksPage(historyState.profile, {
      cursor:historyState.cursor,
      pageSize:8
    });
    const byId = new Map(historyState.items.map((item) => [item.id, item]));
    page.items.forEach((item) => byId.set(item.id, item));
    historyState.items = [...byId.values()];
    historyState.cursor = page.cursor;
    historyState.hasMore = page.hasMore;
    historyState.readCount += page.readCount || 0;
    historyState.initialized = true;
  } catch (error) {
    historyState.error = error?.message || "Erreur inconnue";
  } finally {
    historyState.loading = false;
    render();
  }
}

export function setupCompletedTaskHistory(container, profile) {
  historyState.profile = profile?.role === "admin" ? profile : null;
  const details = container?.querySelector?.("#cockpit-completed-task-history");
  if (!details || !historyState.profile || details.dataset.historyReady === "true") return;
  details.dataset.historyReady = "true";
  details.addEventListener("toggle", () => {
    if (details.open && !historyState.initialized) void load({ reset:true });
  });
  details.querySelector("[data-load-more-completed]")?.addEventListener("click", () => void load());
  details.querySelector("[data-retry-completed]")?.addEventListener("click", () => void load({ reset:!historyState.items.length }));
}

export function invalidateCompletedTaskHistory({ reloadIfOpen = false } = {}) {
  historyState.initialized = false;
  const details = document.querySelector("#cockpit-completed-task-history");
  if (reloadIfOpen && details?.open) void load({ reset:true });
}

export function clearCompletedTaskHistory() {
  resetState({ keepProfile:false });
}
