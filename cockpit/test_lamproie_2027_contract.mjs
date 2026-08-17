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
assert.match(card, /Parties prenantes par fonction/);
assert.match(card, /Communications au 16 août/);
assert.match(card, /Ayer’s Cliff a répondu positivement/);
assert.match(card, /sans doublon/);
assert.match(card, /Fiducie\/Fondation Massawippi/);
assert.match(card, /Documents de synthèse — 16 août 2026/);
assert.match(card, /00_Index_documents_heritages_et_syntheses_Lamproie_du_Nord_2026-08-16\.docx/);
assert.match(card, /01_Synthese_directrice_Lamproie_du_Nord_2027_2026-08-16\.docx/);
assert.match(card, /02_Parties_prenantes_et_suivi_communications_Lamproie_du_Nord_2026-08-16\.docx/);
assert.match(card, /LN_projet2027_Partenaires_fusion_finale_Annie_2026-08-13\.xlsx/);
assert.match(card, /Suivi partenaires — 10 août 2026/);
assert.match(card, /Lettre_partenaires_Lamproie_du_Nord_BROUILLON_2026-08-10\.docx/);
assert.match(card, /REGISTRE_PARTENAIRES_LAMPROIE_2026-08-10\.md/);
assert.match(card, /LAMPROIE_DU_NORD_SUIVI_PARTENAIRES_2026-08-11\.md/);
assert.equal((card.match(/class="internal-project-document-card"/g) || []).length, 16,
  "Les seize ressources Lamproie doivent être présentées sous forme de cartes documentaires homogènes.");
assert.doesNotMatch(card, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  "Aucune adresse personnelle ne doit apparaître dans la fiche Cockpit.");
assert.doesNotMatch(card, /819(?:[ -]?\d){7}/,
  "Aucun numéro de téléphone ne doit apparaître dans la fiche Cockpit.");
assert.match(page, /Report demandé · confirmation écrite attendue/);
assert.match(seed, /"lamproie-du-nord": "planned"/);
assert.match(ui, /status: stage === "completed" \|\| \(isDeferred && !requestedDeferred\) \? "done" : "pending"/);
assert.match(ui, /Le report à \$\{deferredUntil\} a été demandé/);

console.log("Contrat Lamproie 2027 : OK");
