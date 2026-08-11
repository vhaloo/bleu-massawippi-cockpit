import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const seed = fs.readFileSync(new URL("./seed_internal_project_states.js", import.meta.url), "utf8");

const cardStart = page.indexOf('<details class="internal-project" id="internal-project-lamproie-du-nord"');
const cardEnd = page.indexOf('<details class="internal-project" id="internal-project-application-carte-vivante-lac"', cardStart);
const card = cardStart >= 0 && cardEnd > cardStart ? page.slice(cardStart, cardEnd) : "";
assert.ok(card, "La fiche Lamproie du Nord doit rester présente.");
assert.match(card, /data-initial-stage="planned"/);
assert.match(card, /data-deferred-until="2027"/);
assert.match(card, /data-deferred-status="requested"/);
assert.doesNotMatch(card, /class="internal-project urgent"/);
assert.doesNotMatch(card.split(">", 1)[0], /\sopen(?:\s|>)/);
assert.match(card, /REPORT 2027 DEMANDÉ/);
assert.match(card, /confirmation écrite/);
assert.match(card, /1er mars 2027/);
assert.match(card, /31 mars 2027/);
assert.match(card, /Suivi partenaires — 10 août 2026/);
assert.match(card, /Lettre_partenaires_Lamproie_du_Nord_BROUILLON_2026-08-10\.docx/);
assert.match(card, /REGISTRE_PARTENAIRES_LAMPROIE_2026-08-10\.md/);
assert.match(card, /LAMPROIE_DU_NORD_SUIVI_PARTENAIRES_2026-08-11\.md/);
assert.equal((card.match(/class="internal-project-document-card"/g) || []).length, 10,
  "Les dix ressources Lamproie doivent être présentées sous forme de cartes documentaires homogènes.");
assert.match(page, /Report demandé · confirmation écrite attendue/);
assert.match(seed, /"lamproie-du-nord": "planned"/);
assert.match(ui, /status: stage === "completed" \|\| \(isDeferred && !requestedDeferred\) \? "done" : "pending"/);
assert.match(ui, /Le report à \$\{deferredUntil\} a été demandé/);

console.log("Contrat Lamproie 2027 : OK");
