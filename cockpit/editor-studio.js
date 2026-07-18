import { fetchPublicationHistory, savePublicationContent } from "./firebase-client.js?v=20260718-b32";
import {
  PUBLICATION_TEMPLATES,
  normalizePublicationDraft,
  publicationFromScheduleRow,
  resolvePublicationId,
  validatePublicationDraft,
  weekForDate
} from "./publication-editor-schema.mjs?v=20260718-b32";

const runtime = { profile: null, getPosts: () => [], getRows: () => new Map(), button: null, panel: null, form: null, selectedId: "", stableId: "", isNew: false, revision: 0, returnFocus: null };

const style = document.createElement("style");
style.textContent = `
  #cockpit-studio-launch{min-height:40px!important;padding:7px 12px!important;border-color:#74c8cf!important;color:#073a52!important;background:#dff7f6!important;white-space:nowrap}
  #cockpit-studio[hidden]{display:none!important}.studio-shell{position:fixed;inset:0;z-index:1500;display:grid;grid-template-columns:minmax(230px,330px) minmax(0,1fr);color:#183f4e;background:#f4fbfb}.studio-sidebar{display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px;padding:16px;border-right:1px solid #c9dfe2;background:#eaf6f6}.studio-brand{display:flex;align-items:center;justify-content:space-between;gap:12px}.studio-brand h2{margin:0;color:#073a52;font-size:1.2rem}.studio-brand button,.studio-toolbar button,.studio-form-actions button,.studio-history button{min-height:44px;border:1px solid #96bdc3;border-radius:10px;color:#0b6077;background:#fff;font:inherit;font-size:.75rem;font-weight:850;cursor:pointer}.studio-brand button{width:44px;font-size:1.15rem}.studio-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:7px}.studio-toolbar input{grid-column:1/-1;min-height:44px;padding:0 10px;border:1px solid #a9cdd1;border-radius:10px;color:#173f4e;background:#fff}.studio-list{min-height:0;overflow:auto;display:grid;align-content:start;gap:6px}.studio-list button{display:grid;gap:2px;width:100%;padding:10px;border:1px solid #c8dfe1;border-radius:11px;color:#315965;background:#fff;text-align:left;cursor:pointer}.studio-list button[aria-current="true"]{border-color:#0b7895;box-shadow:inset 4px 0 #0b7895;background:#edfafa}.studio-list b{color:#173f4e;font-size:.77rem}.studio-list span{color:#607d86;font-size:.65rem}.studio-main{min-width:0;overflow:auto;padding:18px 22px 90px;background:#f4fbfb}.studio-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.studio-heading h2{margin:0;color:#073a52;font-size:1.45rem}.studio-heading p{margin:4px 0 0;color:#5a7882;font-size:.78rem}.studio-revision{padding:5px 8px;border-radius:999px;color:#315d69;background:#dceef0;font-size:.67rem;font-weight:900}.studio-form{display:grid;gap:14px}.studio-section{padding:15px;border:1px solid #cde1e3;border-radius:15px;background:#fff;box-shadow:0 7px 20px rgba(7,58,82,.05)}.studio-section h3{margin:0 0 10px;color:#174e62;font-size:.95rem}.studio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.studio-grid .wide{grid-column:1/-1}.studio-field{display:grid;gap:5px;min-width:0;color:#315965;font-size:.7rem;font-weight:850}.studio-field :is(input,textarea,select){width:100%;min-height:44px;padding:9px 10px;border:1px solid #b9d2d5;border-radius:9px;color:#173f4e;background:#fff;font:inherit;font-size:.78rem;font-weight:500}.studio-field textarea{min-height:88px;resize:vertical;line-height:1.45}.studio-field textarea[data-field="copy"]{min-height:260px}.studio-check{display:flex;align-items:center;gap:8px;min-height:44px;color:#315965;font-size:.74rem;font-weight:800}.studio-check input{width:19px;height:19px;accent-color:#0b7895}.studio-form-actions{position:sticky;bottom:10px;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px;border:1px solid #9fcbd0;border-radius:14px;background:rgba(239,249,249,.96);box-shadow:0 10px 28px rgba(7,58,82,.16);backdrop-filter:blur(10px)}.studio-form-actions .primary{color:#fff;border-color:#0b7895;background:#0b7895}.studio-form-actions .archive{margin-left:auto;color:#8b4339;border-color:#d6a8a0}.studio-status{flex:1 1 220px;color:#496b75;font-size:.72rem}.studio-status.error{color:#9a4035;font-weight:800}.studio-preview{display:grid;gap:6px;padding:13px;border-left:5px solid #2ab6bb;border-radius:10px;color:#365d69;background:#eff9f9}.studio-preview b{color:#073a52}.studio-preview p{margin:0;white-space:pre-wrap;font-size:.75rem;line-height:1.45}.studio-history{position:fixed;inset:0;z-index:1510;display:grid;place-items:center;padding:20px;background:rgba(4,31,44,.68)}.studio-history[hidden]{display:none}.studio-history-card{width:min(720px,100%);max-height:min(760px,90vh);overflow:auto;padding:18px;border-radius:18px;background:#fff;box-shadow:0 25px 70px rgba(0,0,0,.28)}.studio-history-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.studio-history-list{display:grid;gap:8px;margin-top:12px}.studio-history-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:11px;border:1px solid #d3e4e6;border-radius:11px}.studio-history-item b{display:block;color:#173f4e;font-size:.78rem}.studio-history-item span{display:block;color:#607b84;font-size:.68rem}.studio-empty{padding:16px;color:#607b84;text-align:center;font-size:.78rem}
  .studio-field input[readonly]{color:#426a75;background:#edf6f6;cursor:default}.studio-field-help{color:#69848c;font-size:.62rem;font-weight:600;line-height:1.35}
  [data-theme="dark"] .studio-shell,[data-theme="dark"] .studio-main{color:#e5f3f5;background:#102d36}[data-theme="dark"] .studio-sidebar{border-color:#355b65;background:#173b45}[data-theme="dark"] :is(.studio-brand h2,.studio-heading h2,.studio-section h3,.studio-preview b,.studio-list b){color:#f0fbfc}[data-theme="dark"] :is(.studio-heading p,.studio-status,.studio-list span){color:#b7d2d7}[data-theme="dark"] :is(.studio-section,.studio-list button,.studio-history-card){color:#e5f3f5;border-color:#426873;background:#183b46}[data-theme="dark"] .studio-list button[aria-current="true"]{border-color:#6bcbd2;background:#214d58}[data-theme="dark"] .studio-field{color:#d3e7ea}[data-theme="dark"] .studio-field :is(input,textarea,select),[data-theme="dark"] .studio-toolbar input{color:#eefafa;border-color:#537985;background:#102f39}[data-theme="dark"] .studio-field input[readonly]{color:#c5dde1;background:#173843}[data-theme="dark"] .studio-field-help{color:#aac7cc}[data-theme="dark"] .studio-toolbar input::placeholder{color:#b9d1d5}[data-theme="dark"] .studio-form-actions{border-color:#4d7882;background:rgba(24,59,70,.96)}[data-theme="dark"] .studio-preview{color:#d0e5e8;background:#183f49}[data-theme="dark"] .studio-history-item{border-color:#426873}
  @media(max-width:760px){.studio-shell{grid-template-columns:1fr;grid-template-rows:minmax(250px,36vh) minmax(0,1fr)}.studio-sidebar{grid-template-rows:auto auto minmax(92px,1fr);border-right:0;border-bottom:1px solid #c9dfe2}.studio-main{padding:14px 12px 80px}.studio-grid{grid-template-columns:1fr}.studio-grid .wide{grid-column:auto}.studio-form-actions{position:static}.studio-form-actions .archive{margin-left:0}}
  @media(prefers-reduced-motion:reduce){.studio-shell *{scroll-behavior:auto!important;transition:none!important}}
`;
document.head.appendChild(style);

const fields = ["id", "title", "dateIso", "week", "theme", "tier", "format", "role", "cta", "visual", "source", "fallback", "kpi", "task", "copy", "tasksValentin", "tasksAnnie", "calendarTime", "calendarDurationMinutes", "calendarLocation", "calendarCost", "optionGroup", "optionLabel"];
const minimumDate = () => runtime.getPosts().map((item) => item.dateIso).filter(Boolean).sort()[0] || new Date().toISOString().slice(0, 10);
const rowFor = (id) => runtime.getRows().get(id) || null;
const currentPosts = () => [...runtime.getPosts()].sort((left, right) => String(left.dateIso || "").localeCompare(String(right.dateIso || "")) || String(left.title).localeCompare(String(right.title), "fr"));
const existingPublicationIds = () => {
  const ids = new Set(runtime.getPosts().map((item) => item.id).filter(Boolean));
  const rows = runtime.getRows();
  if (rows && typeof rows.keys === "function") Array.from(rows.keys()).forEach((id) => ids.add(id));
  return ids;
};

function field(name) { return runtime.form?.querySelector(`[data-field="${name}"]`); }
function setStatus(message, error = false) {
  const node = runtime.form?.querySelector("[data-studio-status]");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("error", error);
}
function formDraft() {
  const draft = Object.fromEntries(fields.map((name) => [name, field(name)?.value || ""]));
  draft.id = resolvePublicationId({
    draft,
    existingIds: existingPublicationIds(),
    stableId: runtime.isNew ? "" : runtime.stableId
  });
  draft.week = Number(draft.week || 1);
  draft.calendarDurationMinutes = Number(draft.calendarDurationMinutes || 60);
  draft.choiceRequired = field("choiceRequired")?.checked === true;
  draft.isAlternative = field("isAlternative")?.checked === true;
  draft.archivedEditorial = field("archivedEditorial")?.checked === true;
  draft.templateId = field("templateId")?.value || "blank";
  draft.originId = field("originId")?.value || "";
  return normalizePublicationDraft(draft, { startDateIso: minimumDate() });
}
function setField(name, value) {
  const node = field(name);
  if (!node) return;
  if (node.type === "checkbox") node.checked = value === true;
  else if (["tasksValentin", "tasksAnnie"].includes(name)) node.value = Array.isArray(value) ? value.join("\n") : String(value || "");
  else node.value = value ?? "";
}
function synchronizeAutomaticId() {
  const id = resolvePublicationId({
    draft: { title: field("title")?.value || "", dateIso: field("dateIso")?.value || "" },
    existingIds: existingPublicationIds(),
    stableId: runtime.isNew ? "" : runtime.stableId
  });
  setField("id", id);
  return id;
}
function updatePreview() {
  const preview = runtime.form?.querySelector("[data-studio-preview]");
  if (!preview) return;
  synchronizeAutomaticId();
  const draft = formDraft();
  preview.querySelector("b").textContent = `${draft.date || "Date à choisir"} · ${draft.theme || "Thème"}`;
  preview.querySelector("strong").textContent = draft.title || "Titre de la publication";
  preview.querySelector("p").textContent = draft.copy || "Le texte bilingue apparaîtra ici.";
}
function loadDraft(item, { revision = null, isNew = false } = {}) {
  const row = rowFor(item.id);
  runtime.isNew = isNew === true;
  runtime.stableId = runtime.isNew ? "" : String(item.id || "");
  runtime.selectedId = runtime.isNew ? "" : String(item.id || "");
  runtime.revision = revision ?? Number(row?.editorial?.revision || 0);
  fields.forEach((name) => setField(name, item[name]));
  setField("theme", item.theme || item.t);
  setField("week", item.week || item.w || weekForDate(item.dateIso, minimumDate()));
  setField("templateId", item.templateId || row?.editorial?.templateId || "blank");
  setField("originId", item.originId || row?.editorial?.originId || "");
  setField("choiceRequired", item.choiceRequired);
  setField("isAlternative", item.isAlternative);
  setField("archivedEditorial", item.archivedEditorial);
  runtime.panel.querySelector("[data-studio-revision]").textContent = `Version ${runtime.revision || "nouvelle"}`;
  setStatus(runtime.isNew ? "Nouvelle publication non enregistrée. L’identifiant se construit automatiquement." : "Prêt à modifier. Rien n’est enregistré avant le bouton Enregistrer.");
  updatePreview();
  refreshList();
}
function blankDraft(templateId = "blank") {
  const template = PUBLICATION_TEMPLATES[templateId] || PUBLICATION_TEMPLATES.blank;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return normalizePublicationDraft({ templateId, dateIso: tomorrow, week: weekForDate(tomorrow, minimumDate()), theme: template.theme, tier: template.tier, format: template.format, cta: template.cta, copy: "FR — \n\n=========================================\n\nEN — " }, { startDateIso: minimumDate() });
}
function refreshList() {
  const list = runtime.panel?.querySelector("[data-studio-list]");
  if (!list) return;
  const query = runtime.panel.querySelector("[data-studio-search]")?.value.toLocaleLowerCase("fr") || "";
  list.replaceChildren();
  currentPosts().filter((item) => !query || Object.values(item).join(" ").toLocaleLowerCase("fr").includes(query)).forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.studioItem = item.id;
    button.setAttribute("aria-current", String(item.id === runtime.selectedId));
    const title = document.createElement("b");
    title.textContent = item.title;
    const meta = document.createElement("span");
    const revision = Number(rowFor(item.id)?.editorial?.revision || 0);
    meta.textContent = `${item.date || item.dateIso || "Sans date"} · ${item.t || item.theme || "Sans thème"}${revision ? ` · v${revision}` : ""}${item.archivedEditorial ? " · classée" : ""}`;
    button.append(title, meta);
    button.addEventListener("click", () => loadDraft(item));
    list.appendChild(button);
  });
  if (!list.children.length) list.innerHTML = '<p class="studio-empty">Aucune publication ne correspond à cette recherche.</p>';
}
function buildPanel() {
  const panel = document.createElement("section");
  panel.id = "cockpit-studio";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Studio d’édition des communications");
  panel.innerHTML = `<div class="studio-shell">
    <aside class="studio-sidebar"><div class="studio-brand"><div><h2>✎ Studio</h2><small>Édition structurée et réversible</small></div><button type="button" data-studio-close aria-label="Fermer le Studio" title="Fermer le Studio">×</button></div>
      <div class="studio-toolbar"><input type="search" data-studio-search placeholder="Rechercher une publication…" aria-label="Rechercher une publication"><button type="button" data-studio-new title="Créer une publication à partir d’un modèle">＋ Nouvelle</button><button type="button" data-studio-duplicate title="Dupliquer la publication ouverte">⧉ Dupliquer</button></div><nav class="studio-list" data-studio-list aria-label="Publications"></nav></aside>
    <main class="studio-main"><header class="studio-heading"><div><h2>Éditeur de publication</h2><p>Les changements sont validés, versionnés et archivés; aucune suppression physique.</p></div><span class="studio-revision" data-studio-revision>Nouvelle</span></header>
      <form class="studio-form" data-studio-form><section class="studio-section"><h3>1 · Repères essentiels</h3><div class="studio-grid">
        <label class="studio-field">Modèle<select data-field="templateId">${Object.entries(PUBLICATION_TEMPLATES).map(([id, value]) => `<option value="${id}">${value.label}</option>`).join("")}</select></label>
        <label class="studio-field">Identifiant automatique<input data-field="id" maxlength="80" pattern="[A-Za-z0-9-]{3,80}" readonly aria-readonly="true" required><small class="studio-field-help">Créé à partir de la date et du titre, puis conservé après le premier enregistrement.</small></label>
        <input type="hidden" data-field="originId"><label class="studio-field wide">Titre<input data-field="title" maxlength="220" required></label>
        <label class="studio-field">Date<input type="date" data-field="dateIso" required></label><label class="studio-field">Semaine<input type="number" data-field="week" min="1" max="260" required></label>
        <label class="studio-field">Thème<input data-field="theme" maxlength="80"></label><label class="studio-field">Niveau<input data-field="tier" maxlength="80"></label>
      </div></section>
      <section class="studio-section"><h3>2 · Publication et visuel</h3><div class="studio-grid">
        <label class="studio-field wide">Texte bilingue<textarea data-field="copy" maxlength="10000" required spellcheck="true"></textarea></label>
        <label class="studio-field wide">Direction visuelle<textarea data-field="visual" maxlength="5000" spellcheck="true"></textarea></label>
        <label class="studio-field">Format<input data-field="format" maxlength="220"></label><label class="studio-field">Appel à l’action<input data-field="cta" maxlength="220"></label>
        <label class="studio-field wide">Objectif / rôle<textarea data-field="role" maxlength="5000" spellcheck="true"></textarea></label>
        <label class="studio-field wide">Source ou validation<input data-field="source" maxlength="500"></label>
      </div></section>
      <section class="studio-section"><h3>3 · Responsabilités</h3><div class="studio-grid"><label class="studio-field">Communications · une tâche par ligne<textarea data-field="tasksValentin" maxlength="8000"></textarea></label><label class="studio-field">Direction générale · une tâche par ligne<textarea data-field="tasksAnnie" maxlength="8000"></textarea></label></div></section>
      <details class="studio-section"><summary>＋ Options avancées</summary><div class="studio-grid">
        <label class="studio-field wide">Scénario de repli<textarea data-field="fallback" maxlength="2000"></textarea></label><label class="studio-field">Indicateur à observer<input data-field="kpi" maxlength="500"></label><label class="studio-field">Tâche de production<input data-field="task" maxlength="2000"></label>
        <label class="studio-field">Heure<input type="time" data-field="calendarTime"></label><label class="studio-field">Durée en minutes<input type="number" data-field="calendarDurationMinutes" min="1" max="1440"></label><label class="studio-field">Lieu<input data-field="calendarLocation" maxlength="220"></label><label class="studio-field">Coût<input data-field="calendarCost" maxlength="500"></label>
        <label class="studio-check"><input type="checkbox" data-field="choiceRequired"> Choix entre plusieurs propositions</label><label class="studio-check"><input type="checkbox" data-field="isAlternative"> Proposition alternative</label><label class="studio-field">Groupe de choix<input data-field="optionGroup" maxlength="80"></label><label class="studio-field">Libellé de l’option<input data-field="optionLabel" maxlength="220"></label><label class="studio-check wide"><input type="checkbox" data-field="archivedEditorial"> Classer sans supprimer</label>
      </div></details>
      <section class="studio-section"><h3>Aperçu texte</h3><div class="studio-preview" data-studio-preview><b></b><strong></strong><p></p></div></section>
      <div class="studio-form-actions"><button class="primary" type="submit" title="Valider et enregistrer une nouvelle version">✓ Enregistrer dans le cockpit</button><button type="button" data-studio-history title="Consulter les versions précédentes">↶ Historique</button><span class="studio-status" data-studio-status role="status"></span><button class="archive" type="button" data-studio-archive title="Classer cette publication sans effacer son historique">Classer</button></div></form>
    </main></div><section class="studio-history" data-studio-history-panel hidden><div class="studio-history-card"><div class="studio-history-head"><div><h2>Historique de la publication</h2><p>Restaurer crée une nouvelle version; rien n’est effacé.</p></div><button type="button" data-studio-history-close aria-label="Fermer l’historique">×</button></div><div class="studio-history-list" data-studio-history-list></div></div></section>`;
  document.body.appendChild(panel);
  runtime.panel = panel;
  runtime.form = panel.querySelector("[data-studio-form]");
  panel.querySelectorAll("[data-studio-close]").forEach((button) => button.addEventListener("click", closeStudio));
  panel.querySelector("[data-studio-search]").addEventListener("input", refreshList);
  panel.querySelector("[data-studio-new]").addEventListener("click", () => loadDraft(blankDraft(), { revision: 0, isNew: true }));
  panel.querySelector("[data-studio-duplicate]").addEventListener("click", () => {
    const source = formDraft();
    const date = new Date(`${source.dateIso || new Date().toISOString().slice(0,10)}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 7);
    const dateIso = date.toISOString().slice(0,10);
    loadDraft({ ...source, id: "", title: `${source.title || "Publication"} — copie`, dateIso, week: weekForDate(dateIso, minimumDate()), originId: source.id, archivedEditorial: false }, { revision: 0, isNew: true });
  });
  runtime.form.addEventListener("input", updatePreview);
  runtime.form.addEventListener("change", (event) => {
    if (event.target.matches('[data-field="dateIso"]')) setField("week", weekForDate(event.target.value, minimumDate()));
    if (event.target.matches('[data-field="templateId"]') && runtime.revision === 0) {
      const template = PUBLICATION_TEMPLATES[event.target.value] || PUBLICATION_TEMPLATES.blank;
      setField("theme", template.theme); setField("tier", template.tier); setField("format", template.format); setField("cta", template.cta); updatePreview();
    }
  });
  runtime.form.addEventListener("submit", saveForm);
  panel.querySelector("[data-studio-archive]").addEventListener("click", () => { setField("archivedEditorial", !field("archivedEditorial").checked); saveForm(); });
  panel.querySelector("[data-studio-history]").addEventListener("click", showHistory);
  panel.querySelector("[data-studio-history-close]").addEventListener("click", () => panel.querySelector("[data-studio-history-panel]").hidden = true);
}

async function saveForm(event) {
  event?.preventDefault?.();
  const creating = runtime.isNew;
  synchronizeAutomaticId();
  const draft = formDraft();
  setField("id", draft.id);
  const errors = validatePublicationDraft(draft);
  if (errors.length) { setStatus(errors.join(" "), true); return; }
  const submit = runtime.form.querySelector('button[type="submit"]');
  submit.disabled = true; submit.setAttribute("aria-busy", "true"); setStatus("Enregistrement sécurisé en cours…");
  try {
    const action = draft.archivedEditorial ? "publication classée sans suppression" : creating ? "publication créée dans le Studio" : "publication modifiée dans le Studio";
    const result = await savePublicationContent(draft, runtime.profile, { expectedRevision: runtime.revision, action, mustCreate: creating });
    runtime.selectedId = result.id; runtime.stableId = result.id; runtime.isNew = false; runtime.revision = result.revision;
    runtime.panel.querySelector("[data-studio-revision]").textContent = `Version ${result.revision}`;
    setStatus("Version enregistrée. Le calendrier se mettra à jour dès confirmation de Firebase.");
  } catch (error) { setStatus(error.message || "Enregistrement impossible.", true); }
  finally { submit.disabled = false; submit.removeAttribute("aria-busy"); }
}

async function showHistory() {
  const panel = runtime.panel.querySelector("[data-studio-history-panel]");
  const list = panel.querySelector("[data-studio-history-list]");
  panel.hidden = false; list.innerHTML = '<p class="studio-empty">Chargement de l’historique…</p>';
  try {
    const rows = await fetchPublicationHistory(formDraft().id, { pageSize: 20 });
    list.replaceChildren();
    rows.forEach((entry) => {
      const item = document.createElement("article"); item.className = "studio-history-item";
      const copy = document.createElement("div"); const title = document.createElement("b"); const meta = document.createElement("span");
      title.textContent = entry.action || "Version";
      const when = entry.createdAt?.toDate?.().toLocaleString("fr-CA") || "date en attente";
      meta.textContent = `${when} · ${entry.actorLabel || "Utilisateur"} · version ${entry.after?.editorial?.revision || "?"}`;
      copy.append(title, meta); const restore = document.createElement("button"); restore.type = "button"; restore.textContent = "Restaurer";
      restore.disabled = !entry.after?.editorial;
      restore.addEventListener("click", () => {
        const restored = publicationFromScheduleRow({ id: formDraft().id, ...entry.after });
        loadDraft(restored, { revision: runtime.revision });
        panel.hidden = true;
        setStatus("Version chargée dans le formulaire. Cliquez sur Enregistrer pour créer une nouvelle révision.");
      });
      item.append(copy, restore); list.appendChild(item);
    });
    if (!rows.length) list.innerHTML = '<p class="studio-empty">Aucune version antérieure pour cette publication.</p>';
  } catch (error) {
    list.replaceChildren();
    const message = document.createElement("p");
    message.className = "studio-empty";
    message.textContent = String(error.message || "Historique indisponible.");
    list.append(message);
  }
}

function openStudio() {
  runtime.returnFocus = document.activeElement;
  runtime.panel.hidden = false;
  document.documentElement.style.overflow = "hidden";
  refreshList();
  const selected = currentPosts().find((item) => item.id === runtime.selectedId) || currentPosts()[0] || blankDraft();
  loadDraft(selected);
  runtime.panel.querySelector("[data-studio-search]").focus();
}
function closeStudio() {
  runtime.panel.hidden = true;
  runtime.panel.querySelector("[data-studio-history-panel]").hidden = true;
  document.documentElement.style.overflow = "";
  runtime.returnFocus?.focus?.();
}

export function initPublicationStudio({ profile, getPosts, getRows } = {}) {
  destroyPublicationStudio();
  if (profile?.role !== "admin") return;
  runtime.profile = profile; runtime.getPosts = getPosts || (() => []); runtime.getRows = getRows || (() => new Map());
  buildPanel();
  const session = document.querySelector("#cockpit-session");
  const button = document.createElement("button"); button.id = "cockpit-studio-launch"; button.type = "button"; button.textContent = "✎ Studio"; button.title = "Créer, dupliquer, replanifier ou corriger une publication"; button.setAttribute("aria-label", button.title); button.addEventListener("click", openStudio);
  session?.insertBefore(button, session.querySelector("#cockpit-logout") || null); runtime.button = button;
  document.addEventListener("keydown", onKeydown);
  refreshList();
}
function onKeydown(event) { if (event.key === "Escape" && runtime.panel && !runtime.panel.hidden) closeStudio(); }
export function refreshPublicationStudio() { if (runtime.panel) refreshList(); }
export function destroyPublicationStudio() {
  document.removeEventListener("keydown", onKeydown);
  runtime.button?.remove(); runtime.panel?.remove();
  Object.assign(runtime, { profile:null, getPosts:()=>[], getRows:()=>new Map(), button:null, panel:null, form:null, selectedId:"", stableId:"", isNew:false, revision:0, returnFocus:null });
  document.documentElement.style.overflow = "";
}
