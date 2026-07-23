import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const seed = fs.readFileSync(new URL("./seed_internal_project_states.js", import.meta.url), "utf8");

const cardStart = page.indexOf('<details class="internal-project" id="internal-project-lamproie-du-nord"');
const cardEnd = page.indexOf('<details class="internal-project urgent" id="internal-project-application-carte-vivante-lac"', cardStart);
const card = cardStart >= 0 && cardEnd > cardStart ? page.slice(cardStart, cardEnd) : "";
assert.ok(card, "La fiche Lamproie du Nord doit rester présente.");
assert.match(card, /data-initial-stage="planned"/);
assert.match(card, /data-deferred-until="2027"/);
assert.doesNotMatch(card, /class="internal-project urgent"/);
assert.doesNotMatch(card.split(">", 1)[0], /\sopen(?:\s|>)/);
assert.match(card, /REPORTÉ · 2027/);
assert.match(card, /1er mars 2027/);
assert.match(card, /31 mars 2027/);
assert.match(page, /Relance reportée · obligations contractuelles conservées/);
assert.match(seed, /"lamproie-du-nord": "planned"/);
assert.match(ui, /status: stage === "completed" \|\| isDeferred \? "done" : "pending"/);
assert.match(ui, /Projet reporté à \$\{deferredUntil\}/);

console.log("Contrat Lamproie 2027 : OK");
