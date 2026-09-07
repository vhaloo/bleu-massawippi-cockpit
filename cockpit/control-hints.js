const genericLabels = new Set([
  "ouvrir", "voir", "choisir", "afficher", "réduire", "fermer", "agrandir",
  "modifier", "classer", "retirer", "envoyer", "+", "−", "-", "×", "✕"
]);

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function contextLabel(control) {
  const container = control.closest(".post,.vm-card,.opportunity,.internal-project,.studio-section,article,section,details");
  if (!container) return "";
  const heading = container.querySelector(":scope > summary strong,:scope > header h2,:scope > header h3,:scope > header h4,h2,h3,h4,[data-vm-card-title]");
  return compactText(heading?.textContent).slice(0, 100);
}

function actionLabel(control) {
  const text = compactText(control.getAttribute("aria-label") || control.textContent);
  const normalized = text.toLocaleLowerCase("fr-CA");
  const context = contextLabel(control);
  if (control.matches("summary")) {
    const details = control.closest("details");
    const verb = details?.open ? "Réduire" : "Ouvrir";
    return context ? `${verb} : ${context}` : `${verb} cette section`;
  }
  if (genericLabels.has(normalized) || text.length <= 2) {
    const verb = text === "+" ? "Ouvrir" : ["−", "-"].includes(text) ? "Réduire" : text === "×" || text === "✕" ? "Fermer" : text;
    return context ? `${verb || "Action"} : ${context}` : (verb || "Action disponible");
  }
  if (control.matches("button") && text) return text.slice(0, 120);
  if (control.matches("a") && text.length <= 42) return `Aller à : ${text}`;
  return "";
}

export function applyControlHints(root = document) {
  const controls = root.matches?.("button,a[href],summary") ? [root] : [...root.querySelectorAll("button,a[href],summary")];
  controls.forEach((control) => {
    const label = actionLabel(control);
    if (!label) return;
    const previous = control.dataset.cockpitGeneratedHint;
    if (!control.hasAttribute("title") || (previous && control.title === previous)) {
      control.title = label;
      control.dataset.cockpitGeneratedHint = label;
    }
    const visibleText = compactText(control.textContent);
    if (!control.hasAttribute("aria-label") && (visibleText.length <= 2 || genericLabels.has(visibleText.toLocaleLowerCase("fr-CA")))) {
      control.setAttribute("aria-label", label);
    }
  });
}

export function setupControlHints(root = document) {
  applyControlHints(root);
  let frame = 0;
  const refresh = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      applyControlHints(root);
    });
  };
  addEventListener("cockpit:data-updated", refresh);
  const onToggle = (event) => {
    const summary = event.target?.querySelector?.(":scope > summary");
    if (!summary) return;
    // Preserve deliberately written, detailed help when a section is opened.
    // Only the generic hint owned by this module may be regenerated.
    if (summary.title === summary.dataset.cockpitGeneratedHint) summary.removeAttribute("title");
    applyControlHints(summary);
  };
  root.addEventListener("toggle", onToggle, true);
  return () => {
    removeEventListener("cockpit:data-updated", refresh);
    root.removeEventListener("toggle", onToggle, true);
    if (frame) cancelAnimationFrame(frame);
  };
}
