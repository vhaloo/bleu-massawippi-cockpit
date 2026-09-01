import {
  addProjectEventProposal,
  subscribeProjectCalendarEvents,
  subscribeProjectEventProposals
} from "./firebase-client.js?v=20260901-b70";
import {
  PROJECT_EVENT_CATEGORIES,
  PROJECT_EVENT_STAGES,
  PROJECT_EVENT_URGENCIES,
  PROJECT_PROPOSAL_STATUSES,
  compareProjectCalendarEvents,
  datesForEvent,
  eventIntersectsMonth,
  monthGridDates,
  normalizeProjectEventProposal,
  projectEventIcs
} from "./project-calendar-model.mjs?v=20260901-b70";
import { navigateToEntity } from "./view-mode.js?v=20260901-b70";

const calendarState = {
  profile: null,
  mediaFolderUrl: "",
  safeMode: false,
  events: [],
  proposals: [],
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  eventUnsubscribe: null,
  proposalUnsubscribe: null,
  observer: null,
  nearViewport: false,
  onDictate: null,
  toast: null
};

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const localIso = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (iso, options = {}) => new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", ...options }).format(new Date(`${iso}T12:00:00Z`));
const eventRangeLabel = (event) => {
  const start = dateLabel(event.startDate, { day: "numeric", month: "short", year: "numeric" });
  const end = dateLabel(event.endDate || event.startDate, { day: "numeric", month: "short", year: "numeric" });
  const hours = event.startTime ? ` · ${event.startTime}${event.endTime ? `–${event.endTime}` : ""}` : "";
  return `${start}${event.endDate && event.endDate !== event.startDate ? ` → ${end}` : ""}${hours}`;
};

function shell() { return document.querySelector("#project-calendar"); }
function body() { return shell()?.querySelector("[data-project-calendar-body]"); }

function projectOptions() {
  return [...document.querySelectorAll("[data-internal-project-id]")]
    .map((node) => {
      const label = node.querySelector("summary h3, summary strong, summary b, h3")?.textContent?.trim() || node.dataset.internalProjectId;
      return { id: node.dataset.internalProjectId, label: label.replace(/\s+/g, " ").slice(0, 120) };
    })
    .filter((item) => item.id && item.label)
    .sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

function selectOptions(values, selected = "") {
  return Object.entries(values).map(([value, label]) => `<option value="${esc(value)}"${selected === value ? " selected" : ""}>${esc(label)}</option>`).join("");
}

function mountMarkup() {
  const projects = document.querySelector("#projets");
  if (!projects || shell()) return shell();
  const panel = document.createElement("details");
  panel.id = "project-calendar";
  panel.className = "project-calendar-shell";
  const preferenceKey = `bleu-massawippi-project-calendar-collapsed-${calendarState.profile?.uid || "session"}`;
  panel.open = localStorage.getItem(preferenceKey) !== "true";
  panel.innerHTML = `
    <summary>
      <span class="project-calendar-summary-icon" aria-hidden="true">▦</span>
      <span class="project-calendar-summary-copy"><strong>Calendrier des projets et échéances</strong><small>Rencontres, activités, périodes de travail et dates importantes — séparées des publications</small></span>
      <span class="project-calendar-summary-counts" aria-live="polite"><span class="project-calendar-count" data-project-event-count>Chargement au besoin</span><span class="project-calendar-count" data-project-proposal-count>Propositions</span></span>
    </summary>
    <div class="project-calendar-body" data-project-calendar-body>
      <div class="project-calendar-intro">
        <p><strong>Une idée avec une date?</strong> Déposez-la ici, même si les détails ne sont pas encore arrêtés. Elle restera une proposition jusqu’à sa mise en forme dans le calendrier officiel.</p>
        <button type="button" class="project-calendar-add" data-open-project-event-form>＋ Proposer un événement</button>
      </div>
      <div class="project-calendar-toolbar" aria-label="Navigation du calendrier">
        <button type="button" data-calendar-previous aria-label="Mois précédent">←</button>
        <button type="button" data-calendar-today>Aujourd’hui</button>
        <h3 data-calendar-month-label></h3>
        <button type="button" data-calendar-next aria-label="Mois suivant">→</button>
      </div>
      <ul class="project-calendar-legend" aria-label="Légende">
        <li><span class="project-calendar-dot"></span>À garder en vue</li>
        <li><span class="project-calendar-dot" data-urgency="watch"></span>À surveiller</li>
        <li><span class="project-calendar-dot" data-urgency="important"></span>Important</li>
        <li><span class="project-calendar-dot" data-urgency="urgent"></span>Urgent</li>
        <li><span class="project-calendar-dot" data-stage="completed"></span>Terminé</li>
      </ul>
      <div class="project-calendar-layout">
        <section class="project-calendar-panel" data-calendar-grid-panel aria-label="Calendrier mensuel">
          <div class="project-calendar-weekdays" aria-hidden="true"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div>
          <div class="project-calendar-grid" data-calendar-grid></div>
        </section>
        <section class="project-calendar-panel" aria-label="Échéances du mois"><div class="project-calendar-agenda" data-calendar-agenda><p class="project-calendar-agenda-empty">Ouvrez cette section pour charger les événements.</p></div></section>
      </div>
      <details class="project-calendar-proposals" open>
        <summary>Propositions à mettre en forme <span class="project-calendar-count" data-project-proposal-inline-count>0</span></summary>
        <div class="project-proposals-list" data-project-proposals><p class="project-proposals-empty">Aucune proposition chargée.</p></div>
      </details>
    </div>`;
  const portfolio = projects.querySelector(".project-portfolio-map");
  if (portfolio) portfolio.insertAdjacentElement("afterend", panel);
  else projects.prepend(panel);
  panel.addEventListener("toggle", () => {
    localStorage.setItem(preferenceKey, panel.open ? "false" : "true");
    if (panel.open && calendarState.nearViewport) ensureSubscriptions();
    if (!panel.open) stopSubscriptions();
  });
  return panel;
}

function proposalDialogMarkup() {
  if (document.querySelector("#project-event-dialog")) return;
  const options = projectOptions();
  const dialog = document.createElement("dialog");
  dialog.id = "project-event-dialog";
  dialog.className = "project-event-dialog";
  dialog.innerHTML = `
    <div class="project-event-dialog-header">
      <div><h2>Proposer un événement</h2><p>Inscrivez ce que vous savez aujourd’hui. La proposition n’est pas publiée et ne devient pas automatiquement un événement final.</p></div>
      <button type="button" class="project-event-dialog-close" data-close-project-event-form aria-label="Fermer">×</button>
    </div>
    <form class="project-event-form" data-project-event-form>
      <label class="project-event-full">Titre ou idée *<input name="title" maxlength="180" required autocomplete="off" placeholder="Ex. Rencontre avec la municipalité"></label>
      <label class="project-event-full">Ce qu’il faut savoir
        <span class="project-event-field-with-mic"><textarea name="description" maxlength="4000" placeholder="Contexte, objectif, personnes concernées…"></textarea><button type="button" class="project-event-mic" data-project-event-mic aria-label="Dicter la description">🎙</button></span>
      </label>
      <label>Date de début *<input type="date" name="startDate" required></label>
      <label>Date de fin <input type="date" name="endDate"><span class="project-event-help">Laissez vide pour un événement d’une seule journée.</span></label>
      <label>Type<select name="category">${selectOptions(PROJECT_EVENT_CATEGORIES, "internal_project")}</select></label>
      <label>Niveau d’attention<select name="urgency">${selectOptions(PROJECT_EVENT_URGENCIES, "normal")}</select></label>
      <label class="project-event-full">Projet associé<select name="projectId"><option value="">À préciser ou nouveau projet</option>${options.map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join("")}</select></label>
      <div class="project-event-sharepoint-note">Les fichiers restent dans OneDrive ou SharePoint. Déposez-les dans le dossier approprié, puis collez le lien ou indiquez clairement leur emplacement.${calendarState.mediaFolderUrl ? ` <a href="${esc(calendarState.mediaFolderUrl)}" target="_blank" rel="noopener">Ouvrir Média Cockpit ↗</a>` : ""}</div>
      <label class="project-event-full">Lien OneDrive ou SharePoint<input type="url" name="attachmentUrl" maxlength="2048" placeholder="https://…"></label>
      <label class="project-event-full">Ou emplacement du fichier<input name="attachmentLocation" maxlength="500" placeholder="Ex. Communication site / Documents / Media Cockpit / …"></label>
      <label class="project-event-full">Autres précisions
        <span class="project-event-field-with-mic"><textarea name="notes" maxlength="2000" placeholder="Horaire à confirmer, personnes à appeler, dépendances…"></textarea><button type="button" class="project-event-mic" data-project-event-mic aria-label="Dicter les précisions">🎙</button></span>
      </label>
      <p class="project-event-form-status" data-project-event-form-status aria-live="polite"></p>
      <div class="project-event-form-actions"><button type="button" data-close-project-event-form>Annuler</button><button type="submit">Enregistrer la proposition</button></div>
    </form>`;
  document.body.appendChild(dialog);
  dialog.querySelector('[name="startDate"]').value = localIso();
}

function renderMonth() {
  const panel = shell();
  if (!panel) return;
  const year = calendarState.month.getFullYear();
  const monthIndex = calendarState.month.getMonth();
  panel.querySelector("[data-calendar-month-label]").textContent = new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric" }).format(calendarState.month);
  const monthEvents = calendarState.events.filter((event) => eventIntersectsMonth(event, year, monthIndex)).sort(compareProjectCalendarEvents);
  const byDate = new Map();
  monthEvents.forEach((event) => datesForEvent(event).forEach((iso) => {
    if (!byDate.has(iso)) byDate.set(iso, []);
    byDate.get(iso).push(event);
  }));
  const today = localIso();
  panel.querySelector("[data-calendar-grid]").innerHTML = monthGridDates(year, monthIndex).map((date) => {
    const chips = (byDate.get(date.iso) || []).slice(0, 4).map((event) => `<button type="button" class="project-calendar-chip" data-calendar-event-open="${esc(event.id)}" data-urgency="${esc(event.urgency)}" data-stage="${esc(event.stage)}" title="${esc(event.title)} — ${esc(eventRangeLabel(event))}">${esc(event.title)}</button>`).join("");
    const overflow = (byDate.get(date.iso) || []).length > 4 ? `<span class="project-calendar-day-number">+${(byDate.get(date.iso) || []).length - 4} autre(s)</span>` : "";
    return `<div class="project-calendar-day" data-outside="${date.inMonth ? "false" : "true"}" data-today="${date.iso === today ? "true" : "false"}"><time class="project-calendar-day-number" datetime="${date.iso}">${date.day}</time>${chips}${overflow}</div>`;
  }).join("");
  const agenda = panel.querySelector("[data-calendar-agenda]");
  if (!monthEvents.length) {
    agenda.innerHTML = '<p class="project-calendar-agenda-empty">Aucun événement formalisé pour ce mois.</p>';
  } else {
    agenda.innerHTML = monthEvents.map((event) => eventCardMarkup(event)).join("");
  }
  bindRelatedProjectButtons(agenda);
  const activeEvents = calendarState.events.filter((event) => !["completed", "cancelled"].includes(event.stage) && event.endDate >= today).length;
  panel.querySelector("[data-project-event-count]").textContent = `${activeEvents} événement${activeEvents === 1 ? "" : "s"} à venir`;
}

function eventCardMarkup(event) {
  const category = PROJECT_EVENT_CATEGORIES[event.category] || PROJECT_EVENT_CATEGORIES.other;
  const stage = PROJECT_EVENT_STAGES[event.stage] || PROJECT_EVENT_STAGES.planned;
  const urgency = PROJECT_EVENT_URGENCIES[event.urgency] || PROJECT_EVENT_URGENCIES.normal;
  const documentLink = event.attachmentUrl ? `<a href="${esc(event.attachmentUrl)}" target="_blank" rel="noopener">${esc(event.attachmentLabel || "Ouvrir le document")} ↗</a>` : "";
  const actionLink = event.actionUrl ? `<a href="${esc(event.actionUrl)}" target="_blank" rel="noopener">${esc(event.actionLabel || "Ouvrir le lien")} ↗</a>` : "";
  const projectLink = event.projectId && document.querySelector(`[data-internal-project-id="${CSS.escape(event.projectId)}"]`) ? `<button type="button" data-open-related-project="${esc(event.projectId)}">Ouvrir le projet</button>` : "";
  return `<details class="project-calendar-event" id="project-calendar-event-${esc(event.id)}" data-urgency="${esc(event.urgency)}" data-stage="${esc(event.stage)}">
    <summary><span class="project-calendar-event-meta"><span>${esc(category)}</span><span>·</span><span>${esc(urgency)}</span><span>·</span><span>${esc(stage)}</span></span><b>${esc(event.title)}</b><span class="project-calendar-event-meta">${esc(eventRangeLabel(event))}${event.location ? ` · ${esc(event.location)}` : ""}</span></summary>
    <div class="project-calendar-event-details">${event.summary ? `<p>${esc(event.summary).replace(/\n/g, "<br>")}</p>` : ""}${event.ownerLabel ? `<p><strong>Responsable :</strong> ${esc(event.ownerLabel)}</p>` : ""}<div class="project-calendar-event-actions">${projectLink}${documentLink}${actionLink}<button type="button" data-download-project-event="${esc(event.id)}">Ajouter à mon agenda</button></div></div>
  </details>`;
}

function renderProposals() {
  const panel = shell();
  if (!panel) return;
  const active = calendarState.proposals.filter((proposal) => ["submitted", "in_review"].includes(proposal.status));
  panel.querySelector("[data-project-proposal-count]").textContent = `${active.length} proposition${active.length === 1 ? "" : "s"}`;
  panel.querySelector("[data-project-proposal-inline-count]").textContent = String(active.length);
  const list = panel.querySelector("[data-project-proposals]");
  if (!active.length) {
    list.innerHTML = '<p class="project-proposals-empty">Aucune proposition en attente de mise en forme.</p>';
    return;
  }
  list.innerHTML = active.map((proposal) => {
    const category = PROJECT_EVENT_CATEGORIES[proposal.category] || PROJECT_EVENT_CATEGORIES.other;
    const urgency = PROJECT_EVENT_URGENCIES[proposal.urgency] || PROJECT_EVENT_URGENCIES.normal;
    const status = PROJECT_PROPOSAL_STATUSES[proposal.status] || PROJECT_PROPOSAL_STATUSES.submitted;
    return `<article class="project-proposal-card"><div><b>${esc(proposal.title)}</b><div class="project-proposal-meta"><span>${esc(eventRangeLabel(proposal))}</span><span>·</span><span>${esc(category)}</span><span>·</span><span>${esc(urgency)}</span></div></div><span class="project-proposal-badge">${esc(status)}</span><p>${proposal.description ? esc(proposal.description).replace(/\n/g, "<br>") : "Détails à préciser."}${proposal.attachmentUrl ? ` <a href="${esc(proposal.attachmentUrl)}" target="_blank" rel="noopener">Document ↗</a>` : ""}${proposal.attachmentLocation ? `<br><strong>Emplacement :</strong> ${esc(proposal.attachmentLocation)}` : ""}<br><small>Proposé par ${esc(proposal.authorLabel || "un membre de l’équipe")}</small></p></article>`;
  }).join("");
}

export async function openRelatedProject(control) {
  const projectId = String(control?.dataset.openRelatedProject || "").trim();
  if (!projectId || control.dataset.opening === "true") return false;
  const originalLabel = control.textContent;
  control.dataset.opening = "true";
  control.disabled = true;
  control.setAttribute("aria-busy", "true");
  control.textContent = "Ouverture…";
  try {
    return await navigateToEntity({ type: "project", id: projectId });
  } finally {
    control.disabled = false;
    control.removeAttribute("aria-busy");
    delete control.dataset.opening;
    control.textContent = originalLabel;
  }
}

/**
 * Lie chaque commande au moment où l'agenda est rendu. Le gestionnaire
 * délégué du panneau reste le filet de sécurité pour les autres actions, mais
 * ce lien direct garantit que « Ouvrir le projet » demeure fonctionnel même
 * si un rerendu du cockpit a remplacé le panneau après sa liaison initiale.
 */
export function bindRelatedProjectButtons(root = shell()) {
  root?.querySelectorAll?.("[data-open-related-project]").forEach((control) => {
    if (control.dataset.projectNavigationBound === "true") return;
    control.dataset.projectNavigationBound = "true";
    control.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openRelatedProject(control);
    });
  });
}

async function handleEventAction(event) {
  const openEvent = event.target.closest("[data-calendar-event-open]");
  if (openEvent) {
    const card = document.querySelector(`#project-calendar-event-${CSS.escape(openEvent.dataset.calendarEventOpen)}`);
    if (card) { card.open = true; card.scrollIntoView({ behavior: "smooth", block: "center" }); }
    return;
  }
  const relatedProject = event.target.closest("[data-open-related-project]");
  if (relatedProject) {
    event.preventDefault();
    await openRelatedProject(relatedProject);
    return;
  }
  const download = event.target.closest("[data-download-project-event]");
  if (download) {
    const item = calendarState.events.find((entry) => entry.id === download.dataset.downloadProjectEvent);
    if (!item) return;
    const blob = new Blob([projectEventIcs(item)], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${item.startDate}-${item.title}`.replace(/[^A-Za-z0-9À-ÿ_-]+/g, "-").slice(0, 120) + ".ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
}

function setFormStatus(message, error = false) {
  const node = document.querySelector("[data-project-event-form-status]");
  if (!node) return;
  node.textContent = message;
  node.dataset.error = error ? "true" : "false";
}

async function submitProposal(form) {
  const submit = form.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    submit.disabled = true;
    setFormStatus("Enregistrement…");
    const normalized = normalizeProjectEventProposal(payload);
    await addProjectEventProposal(normalized, calendarState.profile);
    setFormStatus("Proposition enregistrée. Elle attend maintenant sa mise en forme éditoriale.");
    calendarState.toast?.("Proposition d’événement enregistrée.");
    form.reset();
    form.querySelector('[name="startDate"]').value = localIso();
    form.querySelector('[name="category"]').value = "internal_project";
    form.querySelector('[name="urgency"]').value = "normal";
    setTimeout(() => closeDialog(), 650);
  } catch (error) {
    setFormStatus(error.message || "La proposition n’a pas pu être enregistrée.", true);
  } finally {
    submit.disabled = false;
  }
}

function openDialog() {
  proposalDialogMarkup();
  const dialog = document.querySelector("#project-event-dialog");
  setFormStatus("");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  dialog.querySelector('[name="title"]')?.focus();
}

function closeDialog() {
  const dialog = document.querySelector("#project-event-dialog");
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function bindEvents() {
  const panel = shell();
  if (!panel || panel.dataset.bound === "true") return;
  panel.dataset.bound = "true";
  panel.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-project-event-form]")) return openDialog();
    if (event.target.closest("[data-calendar-previous]")) { calendarState.month.setMonth(calendarState.month.getMonth() - 1); renderMonth(); return; }
    if (event.target.closest("[data-calendar-next]")) { calendarState.month.setMonth(calendarState.month.getMonth() + 1); renderMonth(); return; }
    if (event.target.closest("[data-calendar-today]")) { const today = new Date(); calendarState.month = new Date(today.getFullYear(), today.getMonth(), 1); renderMonth(); return; }
    void handleEventAction(event);
  });
  document.querySelector("#project-event-dialog")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-project-event-form]")) return closeDialog();
    const mic = event.target.closest("[data-project-event-mic]");
    if (mic) calendarState.onDictate?.(mic.closest("label")?.querySelector("textarea"));
  });
  document.querySelector("[data-project-event-form]")?.addEventListener("submit", (event) => { event.preventDefault(); submitProposal(event.currentTarget); });
}

function ensureSubscriptions() {
  if (!shell()?.open || !calendarState.profile) return;
  if (!calendarState.eventUnsubscribe) {
    calendarState.eventUnsubscribe = subscribeProjectCalendarEvents((rows) => {
      calendarState.events = rows.sort(compareProjectCalendarEvents);
      renderMonth();
    }, (error) => {
      const agenda = shell()?.querySelector("[data-calendar-agenda]");
      if (agenda) agenda.innerHTML = `<p class="project-calendar-agenda-empty">Le calendrier n’est pas accessible pour le moment. ${esc(error.message || "Réessayez plus tard.")}</p>`;
    });
  }
  if (!calendarState.proposalUnsubscribe) {
    calendarState.proposalUnsubscribe = subscribeProjectEventProposals((rows) => {
      calendarState.proposals = rows;
      renderProposals();
    }, (error) => {
      const list = shell()?.querySelector("[data-project-proposals]");
      if (list) list.innerHTML = `<p class="project-proposals-empty">Les propositions ne sont pas accessibles pour le moment. ${esc(error.message || "Réessayez plus tard.")}</p>`;
    });
  }
}

function stopSubscriptions() {
  calendarState.eventUnsubscribe?.();
  calendarState.proposalUnsubscribe?.();
  calendarState.eventUnsubscribe = null;
  calendarState.proposalUnsubscribe = null;
}

export function setupProjectCalendar({ profile, mediaFolderUrl = "", safeMode = false, onDictate, toast } = {}) {
  clearProjectCalendar();
  calendarState.profile = profile || null;
  calendarState.mediaFolderUrl = mediaFolderUrl;
  calendarState.safeMode = safeMode;
  calendarState.onDictate = onDictate;
  calendarState.toast = toast;
  const panel = mountMarkup();
  if (!panel) return;
  proposalDialogMarkup();
  const addButton = panel.querySelector("[data-open-project-event-form]");
  if (addButton) {
    addButton.disabled = safeMode || !["director", "admin"].includes(profile?.role);
    if (addButton.disabled) addButton.title = safeMode ? "Le mode secours est en lecture seule." : "Ce compte ne peut pas proposer un événement.";
  }
  bindEvents();
  renderMonth();
  renderProposals();
  if ("IntersectionObserver" in globalThis) {
    calendarState.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        calendarState.nearViewport = true;
        ensureSubscriptions();
      }
    }, { rootMargin: "500px 0px" });
    calendarState.observer.observe(panel);
  } else {
    calendarState.nearViewport = true;
    ensureSubscriptions();
  }
}

export function clearProjectCalendar({ preserveDom = false } = {}) {
  stopSubscriptions();
  calendarState.observer?.disconnect();
  calendarState.observer = null;
  calendarState.nearViewport = false;
  calendarState.events = [];
  calendarState.proposals = [];
  document.querySelector("#project-event-dialog")?.remove();
  if (!preserveDom) document.querySelector("#project-calendar")?.remove();
}
