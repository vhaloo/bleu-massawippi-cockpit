export const internalProjectUrgencyOrder = Object.freeze([
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
  "poesie-du-lac",
  "jeux-provinciaux-peche"
]);

export function setInternalProjectArchiveVisibility(root = document, active = false) {
  const register = root.querySelector("[data-internal-project-register]");
  const toggle = register?.querySelector("[data-toggle-internal-project-archives]");
  if (!register || !toggle) return { active: false, archived: 0 };
  const archived = register.querySelectorAll(".internal-project.is-archived").length;
  register.classList.toggle("show-internal-project-archives", Boolean(active));
  toggle.setAttribute("aria-pressed", String(Boolean(active)));
  toggle.innerHTML = `${active ? "Masquer les archives" : "Voir les archives"} (<b data-internal-project-archive-count>${archived}</b>)`;
  const summary = register.querySelector("[data-internal-project-archive-summary]");
  if (summary) {
    summary.hidden = !active;
    summary.textContent = active
      ? `${archived} projet${archived === 1 ? "" : "s"} archivé${archived === 1 ? "" : "s"} affiché${archived === 1 ? "" : "s"} en premier dans la liste.`
      : "";
  }
  return { active: Boolean(active), archived };
}

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
  cards.forEach((card) => {
    if (card.dataset.initialStage === "completed") card.classList.add("is-archived");
    list.appendChild(card);
  });
  register.dataset.layoutVersion = "2026-09-01-archives-v1";

  const spotlight = root.querySelector('.project-portfolio-links a[href="#internal-project-lamproie-du-nord"]');
  if (spotlight) {
    spotlight.href = "#internal-project-nettoyage-berges-2026";
    spotlight.title = "Ouvrir le projet prioritaire Nettoyage des berges";
    const marker = spotlight.querySelector("b");
    const title = spotlight.querySelector("strong");
    const detail = spotlight.querySelector("small");
    if (marker) marker.textContent = "09/26";
    if (title) title.textContent = "Nettoyage des berges";
    if (detail) detail.textContent = "North Hatley et Ayer’s Cliff · coordination en cours";
  }
  return cards.map((card) => card.dataset.internalProjectId);
}
