/** Presentation metadata only: never changes project priority, stage or content. */
const GROUPS = {
  "Gestion et continuité": ["continuite-2027"],
  "Terrain et restauration": ["nettoyage-berges-2026", "jardins-pluie-2027", "parc-lobadanaki", "geogrid-bandes-riveraines"],
  "Recherche et suivi du lac": ["lamproie-du-nord", "bilan-sante-lac", "chute-burroughs-consultation", "caracterisation-benthos", "surveillance-cyanobacteries", "moules-zebrees-continuite"],
  "Mobilisation et événements": ["technicien-un-jour", "jeux-provinciaux-peche", "concours-dessin-jeunesse", "poesie-du-lac", "participation-photo-regards-massawippi"],
  "Communications et outils": ["application-carte-vivante-lac", "carte-fetes-2026"],
  "Financement et partenariats": ["fonds-environnemental-partenarial", "colloque-reseautage-associations", "concours-universitaire-bourse"]
};
export const PROJECT_GROUPINGS = Object.freeze({ type: "Type de projet", urgency: "Urgence / échéance", theme: "Thème", status: "État d’avancement", title: "Ordre alphabétique" });
export function projectType(item) { return item.type || (item.opportunity ? "Pistes de financement" : Object.entries(GROUPS).find(([,ids])=>ids.includes(item.id))?.[0] || "Autres projets"); }
export function projectTheme(item) {
  if (item.theme) return item.theme;
  const text = `${item.id} ${item.title}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/atlas|carte-vivante|geogrid/.test(text)) return "Données et outils";
  if (/benthos|lamproie|moule|peche|faune/.test(text)) return "Biodiversité";
  if (/bilan|eau|cyanob|plage|burroughs/.test(text)) return "Qualité de l’eau";
  if (/berge|pluie|parc|riveraine/.test(text)) return "Rives et bassin versant";
  if (/continuite/.test(text)) return "Organisation de Bleu";
  if (item.opportunity || /fonds|bourse|partenariat|colloque/.test(text)) return "Financement et collaboration";
  return "Vie associative et mobilisation";
}
export function projectUrgency(item, today) {
  if (item.archived) return "Archives";
  if (item.stage === "blocked") return "Blocage à résoudre";
  const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value || "") && Number.isFinite(Date.parse(value + "T12:00Z"));
  if (valid(today) && valid(item.deadline)) {
    if (item.deadline < today) return "Échéance à réexaminer";
    if (item.deadline <= new Date(Date.parse(today + "T12:00Z") + 7*86400000).toISOString().slice(0,10)) return "Échéance dans les 7 jours";
  }
  if (item.priority === "high") return "Priorité élevée";
  return valid(item.deadline) ? "Échéance ultérieure" : "Échéance à préciser";
}
export function groupProjects(items, grouping = "type", today = "") {
  const groups = new Map();
  for (const item of items) {
    const label = grouping === "urgency" ? projectUrgency(item,today) : grouping === "theme" ? projectTheme(item) : grouping === "status" ? item.status || "À préciser" : grouping === "title" ? "Tous les dossiers" : projectType(item);
    if (!groups.has(label)) groups.set(label, []); groups.get(label).push(item);
  }
  const urgencyOrder = ["Blocage à résoudre", "Échéance à réexaminer", "Échéance dans les 7 jours", "Priorité élevée", "Échéance ultérieure", "Échéance à préciser", "Archives"];
  return [...groups].sort(([a],[b])=>grouping === "urgency" ? urgencyOrder.indexOf(a)-urgencyOrder.indexOf(b) : a.localeCompare(b,"fr")).map(([label,rows])=>({label,items:[...rows].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||a.title.localeCompare(b.title,"fr"))}));
}
