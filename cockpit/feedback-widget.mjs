/** Presentation only: reuse the authenticated feedback writer supplied by the cockpit. */
export function buildFeedbackWidget({ document: doc, formMarkup, onSubmit }) {
  const existing = doc.getElementById("cockpit-feedback-launch");
  if (existing) return { launch: existing, panel: doc.getElementById("cockpit-feedback-panel") };
  const launch = doc.createElement("button");
  launch.id = "cockpit-feedback-launch";
  launch.type = "button";
  launch.textContent = "💡 Boîte à idées";
  launch.title = "Proposer une amélioration, signaler un problème ou donner une recommandation pour tout le cockpit. Votre idée sera conservée et suivie.";
  launch.setAttribute("aria-expanded", "false");
  launch.setAttribute("aria-controls", "cockpit-feedback-panel");
  const panel = doc.createElement("section");
  panel.id = "cockpit-feedback-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Boîte à idées — améliorer le cockpit");
  panel.innerHTML = `<button type="button" data-feedback-close title="Fermer la boîte à idées sans effacer le texte saisi" aria-label="Fermer la boîte à idées">Fermer ×</button><h2>Améliorer le cockpit</h2><p>Une idée, un problème ou une recommandation pour tout le cockpit ? Déposez-la ici. Pour parler d’une publication, utilisez plutôt ses commentaires.</p>${formMarkup}`;
  const setOpen = open => {
    panel.hidden = !open;
    panel.classList.toggle("open", open);
    launch.setAttribute("aria-expanded", String(open));
    if (open) panel.querySelector("textarea")?.focus();
    else launch.focus();
  };
  launch.addEventListener("click", () => setOpen(panel.hidden));
  panel.querySelector("[data-feedback-close]").addEventListener("click", () => setOpen(false));
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
  });
  panel.querySelector("[data-feedback-form]").addEventListener("submit", event => {
    event.preventDefault();
    onSubmit(event.currentTarget);
  });
  doc.body.append(launch, panel);
  return { launch, panel };
}
