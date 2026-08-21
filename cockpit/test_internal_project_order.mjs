import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";
import { internalProjectUrgencyOrder, sortInternalProjectsByUrgency } from "./internal-project-order.js";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const projectIds = [...page.matchAll(/<details class="internal-project(?:\s[^"]*)?"[^>]*data-internal-project-id="([^"]+)"/g)]
  .map((match) => match[1]);
const renderedByRole = new Map(["director", "admin"].map((role) => {
  const { document } = parseHTML(page);
  document.body.className = role === "admin" ? "cockpit-admin" : "cockpit-director";
  return [role, { document, order: sortInternalProjectsByUrgency(document) }];
}));
const { document, order: renderedOrder } = renderedByRole.get("director");
const applicationProject = document.querySelector('[data-internal-project-id="application-carte-vivante-lac"]');

assert.equal(new Set(internalProjectUrgencyOrder).size, internalProjectUrgencyOrder.length, "Le classement ne doit contenir aucun doublon.");
assert.deepEqual(new Set(internalProjectUrgencyOrder), new Set(projectIds), "Chaque projet existant doit être classé une seule fois.");
assert.deepEqual(renderedOrder, internalProjectUrgencyOrder, "Le DOM doit suivre exactement le classement déclaré.");
assert.deepEqual(renderedByRole.get("admin").order, internalProjectUrgencyOrder, "Les communications doivent voir le même portefeuille priorisé.");
assert.equal(renderedOrder[0], "poesie-du-lac", "Au bord du bleu doit être la première priorité visible.");
assert.equal(renderedOrder.at(-2), "lamproie-du-nord", "Lamproie du Nord doit rester presque au bas de la liste.");
assert.equal(renderedOrder.at(-1), "jeux-provinciaux-peche", "Le dossier clos doit demeurer en dernière position.");
assert.ok(renderedOrder.indexOf("bilan-sante-lac") < renderedOrder.indexOf("application-carte-vivante-lac"), "Le travail terrain actif doit précéder le cadrage sans échéance.");
assert.ok(renderedOrder.indexOf("application-carte-vivante-lac") < renderedOrder.indexOf("jardins-pluie-2027"), "La maquette d’application déjà engagée doit précéder le nouveau cadrage Jardin de pluie.");
assert.ok(renderedOrder.indexOf("jardins-pluie-2027") < renderedOrder.indexOf("surveillance-cyanobacteries"), "La proposition municipale V7 doit rester visible dans le premier groupe de travail.");
assert.ok(renderedOrder.indexOf("concours-dessin-jeunesse") < renderedOrder.indexOf("lamproie-du-nord"), "Les deux dossiers 2027 doivent rester regroupés près du bas.");
assert.ok(ui.indexOf("sortInternalProjectsByUrgency();") < ui.indexOf("decorateInternalProjectDocuments();"), "Le classement doit être appliqué avant les interactions des fiches.");
assert.equal(document.querySelector(".project-portfolio-links a:nth-of-type(3)")?.getAttribute("href"), "#internal-project-poesie-du-lac", "Le raccourci prioritaire doit mener vers Au bord du bleu.");
assert.equal(document.querySelector("[data-internal-project-register]")?.dataset.layoutVersion, "2026-08-11-urgency-order-v2", "Le changement d'ordre doit être signalé comme une nouveauté de mise en page.");
assert.equal(applicationProject?.dataset.initialStage, "to_frame", "Le cahier annoncé ne doit pas transformer le cadrage en production active ou terminée.");
assert.equal(applicationProject?.dataset.waitingSource, "functional-spec-pending", "Le dossier doit rester explicitement en attente du cahier des charges annoncé.");
assert.match(applicationProject?.textContent || "", /En attente du cahier/);
assert.match(applicationProject?.textContent || "", /Aucun fichier ni contenu correspondant n’a été reçu/);
assert.match(applicationProject?.textContent || "", /aucune validation, approbation ou action de production n’est déduite/);

console.log("✓ projets internes classés par urgence, sans perte de fiche");
