import { parseHTML } from "linkedom";

const { document, window } = parseHTML(`<!doctype html><body>
  <details><summary><strong>Dossier Lamproie</strong><small>Ouvrir</small></summary><p>Contenu</p></details>
  <article><h3>Publication du mardi</h3><button>Ouvrir</button></article>
  <button aria-label="Fermer le panneau">×</button>
</body>`);
globalThis.document = document;
globalThis.window = window;
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.removeEventListener = window.removeEventListener.bind(window);
globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
globalThis.cancelAnimationFrame = () => {};

const { applyControlHints, setupControlHints } = await import("./control-hints.js");
applyControlHints(document);

const summary = document.querySelector("summary");
const open = document.querySelector("article button");
const close = document.querySelector("body > button");
if (!summary.title.includes("Dossier Lamproie")) throw new Error("Le résumé n’explique pas sa destination.");
if (!open.title.includes("Publication du mardi")) throw new Error("Le bouton générique n’utilise pas son contexte.");
if (close.getAttribute("aria-label") !== "Fermer le panneau") throw new Error("Un libellé explicite a été écrasé.");
console.log("✓ Infobulles contextuelles et libellés accessibles : test réussi.");
const dynamic = document.createElement("button"); dynamic.textContent = "Mes tâches · 4"; document.body.append(dynamic);
applyControlHints(document);
dynamic.textContent = "Mes tâches · 2"; applyControlHints(document);
if (dynamic.title.includes("4") || !dynamic.title.includes("2")) throw new Error("Infobulle périmée après changement du compteur.");
dynamic.title = "Aide personnalisée"; dynamic.textContent = "Mes tâches · 1"; applyControlHints(document);
if (dynamic.title !== "Aide personnalisée") throw new Error("Aide manuelle remplacée.");
const cleanup = setupControlHints(document);
summary.title = "Retrouver les outils sans masquer les textes ni les images.";
summary.parentElement.dispatchEvent(new window.Event("toggle", { bubbles: true }));
if (summary.title !== "Retrouver les outils sans masquer les textes ni les images.") throw new Error("Une infobulle détaillée est perdue au dépliage.");
cleanup();
console.log("✓ Les explications détaillées survivent à l’ouverture et les écouteurs sont nettoyés.");
