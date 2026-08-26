export const internalProjectUrgencyOrder = Object.freeze([
  "poesie-du-lac",
  "nettoyage-berges-2026",
  "bilan-sante-lac",
  "parc-lobadanaki",
  "application-carte-vivante-lac",
  "jardins-pluie-2027",
  "surveillance-cyanobacteries",
  "caracterisation-benthos",
  "fonds-environnemental-partenarial",
  "moules-zebrees-continuite",
  "colloque-reseautage-associations",
  "participation-photo-regards-massawippi",
  "carte-fetes-2026",
  "concours-universitaire-bourse",
  "technicien-un-jour",
  "concours-dessin-jeunesse",
  "lamproie-du-nord",
  "jeux-provinciaux-peche"
]);

export function sortInternalProjectsByUrgency(root = document) {
  const register = root.querySelector("[data-internal-project-register]");
  const list = register?.querySelector(".internal-project-list");
  if (!register || !list) return [];
  const ranks = new Map(internalProjectUrgencyOrder.map((projectId, index) => [projectId, index]));
  const cards = [...list.querySelectorAll(":scope > .internal-project")];
  const sourceOrder = new Map(cards.map((card, index) => [card, index]));
  cards.sort((left, right) => (ranks.get(left.dataset.internalProjectId) ?? Number.MAX_SAFE_INTEGER)
    - (ranks.get(right.dataset.internalProjectId) ?? Number.MAX_SAFE_INTEGER)
    || sourceOrder.get(left) - sourceOrder.get(right));
  cards.forEach((card) => list.appendChild(card));
  register.dataset.layoutVersion = "2026-08-26-nettoyage-berges-v1";

  const spotlight = root.querySelector('.project-portfolio-links a[href="#internal-project-lamproie-du-nord"]');
  if (spotlight) {
    spotlight.href = "#internal-project-poesie-du-lac";
    spotlight.title = "Ouvrir le projet prioritaire Au bord du bleu";
    const marker = spotlight.querySelector("b");
    const title = spotlight.querySelector("strong");
    const detail = spotlight.querySelector("small");
    if (marker) marker.textContent = "30/08";
    if (title) title.textContent = "Au bord du bleu";
    if (detail) detail.textContent = "Accueil 13 h · programme dès 13 h 40";
  }
  return cards.map((card) => card.dataset.internalProjectId);
}
