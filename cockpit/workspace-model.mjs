/** Pure presentation model. Never changes a date, approval, or source object. */
export const WORKSPACE_VERSION = "20260907-v2.2";
export const SPACES = Object.freeze({
  accueil: { label: "À faire", icon: "◉", title: "Un peu de clarté pour avancer.", description: "Vos décisions, les nouveautés et le travail qui vous attend." },
  publications: { label: "Publications", icon: "▤", title: "Les mots et les images du lac.", description: "Le calendrier des réseaux sociaux, les propositions et leur historique." },
  projets: { label: "Projets", icon: "◇", title: "Chaque dossier, à sa place.", description: "Les projets, leurs échéances, leurs documents et les décisions à prendre." },
  bibliotheque: { label: "Bibliothèque", icon: "▥", title: "Retrouver le bon document.", description: "Les références du cockpit restent liées à leur dossier et à leur original." }
});
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
