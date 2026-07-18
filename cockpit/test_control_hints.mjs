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

const { applyControlHints } = await import("./control-hints.js");
applyControlHints(document);

const summary = document.querySelector("summary");
const open = document.querySelector("article button");
const close = document.querySelector("body > button");
if (!summary.title.includes("Dossier Lamproie")) throw new Error("Le résumé n’explique pas sa destination.");
if (!open.title.includes("Publication du mardi")) throw new Error("Le bouton générique n’utilise pas son contexte.");
if (close.getAttribute("aria-label") !== "Fermer le panneau") throw new Error("Un libellé explicite a été écrasé.");
console.log("✓ Infobulles contextuelles et libellés accessibles : test réussi.");
