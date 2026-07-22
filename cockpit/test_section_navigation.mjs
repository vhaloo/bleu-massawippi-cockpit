import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const source = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const links = [...source.matchAll(/<a href="#([^"]+)" data-section-route[^>]*>[\s\S]*?<\/a>/g)];
assert.deepEqual(links.map((match) => match[1]), [
  "projets-internes",
  "occasions-a-saisir",
  "internal-project-lamproie-du-nord"
], "Les trois raccourcis du portefeuille doivent rester explicitement routés.");
assert.ok(source.includes("Candidatures et financement"), "Le raccourci externe doit décrire sa destination humaine.");
assert.ok(source.includes("Entente signée · suivi financier et reddition"), "La priorité doit expliquer pourquoi elle est prioritaire.");

const { document, window } = parseHTML(`<!doctype html><body>
  <nav>
    <a href="#projets-internes" data-section-route>Interne</a>
    <a href="#occasions-a-saisir" data-section-route>Externe</a>
    <a href="#internal-project-lamproie-du-nord" data-section-route>Priorité</a>
  </nav>
  <details id="projets-internes"><div><details id="internal-project-lamproie-du-nord"></details></div></details>
  <details id="occasions-a-saisir"></details>
</body>`);
Object.assign(globalThis, {
  document,
  window,
  requestAnimationFrame: (callback) => callback(),
  matchMedia: () => ({ matches: true })
});
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) { this.__scrollOptions = options; };
window.HTMLElement.prototype.focus = function focus() { this.__focused = true; };
const historyCalls = [];
globalThis.history = { replaceState: (...args) => historyCalls.push(args) };

const { setupSectionNavigation } = await import("./section-navigation.js");
const cleanup = setupSectionNavigation({ root: document });
for (const link of document.querySelectorAll("[data-section-route]")) {
  link.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
  const target = document.getElementById(link.getAttribute("href").slice(1));
  assert.equal(target.open, true, `${target.id} doit être ouvert avant le défilement.`);
  assert.equal(target.__scrollOptions?.block, "start", `${target.id} doit être positionné comme destination.`);
  assert.equal(target.__focused, true, `${target.id} doit recevoir le focus pour le clavier.`);
}
assert.equal(document.getElementById("projets-internes").open, true, "Le parent de la priorité doit être ouvert.");
assert.deepEqual(historyCalls.map((call) => call[2]), [
  "#projets-internes",
  "#occasions-a-saisir",
  "#internal-project-lamproie-du-nord"
]);
cleanup();

console.log("✓ raccourcis du portefeuille : panneaux ouverts, focus et destinations distinctes");
