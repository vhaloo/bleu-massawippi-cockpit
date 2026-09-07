/** Pure presentation model. Never changes a date, approval, or source object. */
export const WORKSPACE_VERSION = "20260907-v2.4";
export const SPACES = Object.freeze({
  accueil: { label: "À faire", icon: "decisions", title: "Un peu de clarté pour avancer.", description: "Vos décisions, les nouveautés et le travail qui vous attend." },
  publications: { label: "Publications", icon: "publications", title: "Les mots et les images du lac.", description: "Le calendrier des réseaux sociaux, les propositions et leur historique." },
  projets: { label: "Projets", icon: "folder", title: "Chaque dossier, à sa place.", description: "Les projets, leurs échéances, leurs documents et les décisions à prendre." },
  bibliotheque: { label: "Bibliothèque", icon: "library", title: "Retrouver le bon document.", description: "Les références du cockpit restent liées à leur dossier et à leur original." }
});
const ICONS = Object.freeze({
  decisions: '<path d="M9 5h11M9 12h11M9 19h11M2 5l2 2 3-4M2 12l2 2 3-4M2 19l2 2 3-4"/>',
  publications: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m4 16 5-5 4 4 3-3 4 4M7 7h.01"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10H3Z"/>',
  library: '<path d="M3 4h4v16H3zM10 4h4v16h-4zM17 5l3-1 3 15-3 1zM3 8h4M10 8h4"/>',
  socialCalendar: '<rect x="2" y="4" width="19" height="17" rx="3"/><path d="M7 2v4M16 2v4M2 9h19M9 13H7v8M5 16h5"/><rect x="13" y="12" width="6" height="6" rx="2"/><circle cx="16" cy="15" r="1"/>',
  projectCalendar: '<rect x="2" y="4" width="19" height="17" rx="3"/><path d="M7 2v4M16 2v4M2 9h19M6 13h4l2 2h6v4H6Z"/>',
  messages: '<path d="M21 4H3v13h5l4 4v-4h9ZM7 8h10M7 12h6"/>',
  archive: '<path d="M4 8h16v13H4ZM2 3h20v5H2ZM9 12h6"/>',
  document: '<path d="M5 2h9l5 5v15H5ZM14 2v6h5M9 12h6M9 16h6"/>',
  tools: '<path d="M8 4H3M21 4h-7M8 12H3M21 12h-7M8 20H3M21 20h-7"/><circle cx="11" cy="4" r="3"/><circle cx="11" cy="12" r="3"/><circle cx="11" cy="20" r="3"/>',
  history: '<path d="M3 10a9 9 0 1 1 1 8M3 3v7h7M12 7v6l4 2"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5M12 17h.01"/>',
  leaf: '<path d="M20 3C5 1 1 10 6 17s17 0 14-14ZM5 21 17 7"/>',
  water: '<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13ZM8 16c0 2 1 3 3 3"/>',
  microphone: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>',
  list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>'
});
export function workspaceIcon(name) {
  return `<svg class="v2-icon" data-icon="${ICONS[name] ? name : "document"}" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.document}</svg>`;
}
export function topicIcon(value) {
  const text = String(value || "").toLocaleLowerCase("fr");
  return /poésie|poetry|bord du bleu/.test(text) ? "microphone" : /application|numérique/.test(text) ? "phone" : /lamproie|faune|biodivers|berges/.test(text) ? "leaf" : /eau|lac|plage|niveau/.test(text) ? "water" : "folder";
}
/** Stable neighbour window, bounded in size; never reorders the source registry. */
export function publicationNeighbours(items, id, radius = 4) {
  const ordered = sortPublications(items.filter(item => validCivilDate(item.dateIso) && (!item.archivedEditorial || item.id === id) && (item.decision !== "deferred" || item.id === id)));
  const index = ordered.findIndex(item => item.id === id);
  if (index < 0) return { previous: null, next: null, items: [], index: -1, total: ordered.length };
  const span = Math.max(1, Math.min(8, Math.trunc(radius) || 4));
  const start = Math.max(0, Math.min(index - span, ordered.length - (span * 2 + 1)));
  return { previous: ordered[index - 1] || null, next: ordered[index + 1] || null, items: ordered.slice(start, start + span * 2 + 1), index, total: ordered.length };
}
/** Display-only choice. A thumbnail never creates an approval or changes order. */
export function previewCandidates(rows, choice) {
  const available = rows.filter(row => row.archived !== true && row.kind === "image");
  const side = choice?.direction?.status === "selected" ? "direction" : choice?.communications?.status === "selected" ? "communications" : "";
  const ids = side ? choice[side].mediaIds || [] : [];
  const selected = ids.map(id => available.find(row => row.id === id)).filter(Boolean);
  if (selected.length) return selected.map(row => ({ row, label: side === "direction" ? "Choix de la direction" : "Recommandation des communications" }));
  // Legacy flags are only meaningful without a structured decision.
  const legacy = !choice ? available.filter(row => row.selectedFinal === true) : [];
  return (legacy.length ? legacy : available).map(row => ({ row, label: legacy.length ? "Média retenu dans l’historique" : "Proposition · choix à confirmer" }));
}
export function interfaceUrl(href, target, postIds = []) {
  const url = new URL(href);
  if (target === "v2") {
    url.searchParams.set("interface", "v2");
    const raw = url.hash.slice(1);
    let id = raw; try { id = decodeURIComponent(raw); } catch { /* retain safe legacy route */ }
    if (postIds.includes(id)) url.hash = routeHash("publications", id);
    else if (!url.hash || url.hash === "#calendrier" || url.hash === "#posts") url.hash = routeHash("publications", "", "calendrier");
  } else {
    url.searchParams.delete("interface");
    const route = parseRoute(url.hash);
    url.hash = route.legacy ? `#${route.legacy}` : route.id && postIds.includes(route.id) ? `#${encodeURIComponent(route.id)}` : route.space === "projets" ? "#projets" : route.space === "publications" ? "#calendrier" : route.space === "bibliotheque" ? "#sources" : "";
  }
  return url.href;
}
export function validCivilDate(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function todayKey(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function prettyDate(iso, options = { weekday: "long", day: "numeric", month: "long" }) {
  return validCivilDate(iso) ? new Intl.DateTimeFormat("fr-CA", { ...options, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)) : "Sans date confirmée";
}
export function sortPublications(items) {
  return [...items].sort((a, b) => (validCivilDate(a.dateIso) ? a.dateIso : "9999").localeCompare(validCivilDate(b.dateIso) ? b.dateIso : "9999") || String(a.id).localeCompare(String(b.id), "fr", { numeric: true }));
}
export function monthDays(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month)) || !validCivilDate(`${month}-01`)) throw new Error("Mois invalide.");
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
}
export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1, 12)).toISOString().slice(0, 7);
}
export function routeHash(space = "accueil", id = "", view = "") {
  return `#/${SPACES[space] ? space : "accueil"}${id ? `/${encodeURIComponent(id)}` : ""}${view ? `?vue=${encodeURIComponent(view)}` : ""}`;
}
export function parseRoute(hash) {
  const raw = String(hash || "").replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const [space, encoded = ""] = path.split("/");
  if (!SPACES[space]) return { space: "accueil", id: "", view: "", legacy: raw };
  let id = ""; try { id = decodeURIComponent(encoded); } catch { /* malformed link: never throw */ }
  return { space, id, view: new URLSearchParams(query).get("vue") || "", legacy: "" };
}
export function publicationState({ stage = "proposal", contentApproved = false, mediaApproved = false, decision = "" } = {}) {
  if (stage === "published") return { label: "Terminé · publié/programmé", tone: "done" };
  if (stage === "scheduled") return { label: "Programmé", tone: "done" };
  if (decision === "rejected") return { label: "Angle écarté", tone: "muted" };
  if (decision === "deferred") return { label: "À replanifier", tone: "waiting" };
  if (stage === "changes_requested" || stage === "media_changes_requested") return { label: "Ajustement demandé", tone: "attention" };
  if (contentApproved && mediaApproved) return { label: "Prêt à programmer", tone: "ready" };
  if (contentApproved) return { label: "Visuel à approuver", tone: "waiting" };
  return { label: stage === "content_review" ? "Texte à relire" : "En préparation", tone: "waiting" };
}
export function filterPublications(items, { view = "liste", query = "", status = "all", today = todayKey() } = {}) {
  const q = query.trim().toLocaleLowerCase("fr");
  return sortPublications(items).filter(item => {
    const reserve = !validCivilDate(item.dateIso) || item.decision === "deferred";
    const archive = item.archivedEditorial === true || (validCivilDate(item.dateIso) && item.dateIso < today && !reserve);
    if (view === "calendrier" ? reserve || item.archivedEditorial === true : view === "archives" ? !archive : view === "reserve" ? !reserve : archive || reserve) return false;
    if (status !== "all" && item.state?.tone !== status) return false;
    return !q || `${item.title} ${item.copy} ${item.t} ${item.date} ${item.dateIso} ${item.id}`.toLocaleLowerCase("fr").includes(q);
  });
}
export function safeLink(value) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
export function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
