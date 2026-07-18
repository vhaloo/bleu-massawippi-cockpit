import assert from "node:assert/strict";
import fs from "node:fs";

const strategy = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cockpitUi = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const clarity = fs.readFileSync(new URL("./clarity.css", import.meta.url), "utf8");
const motion = fs.readFileSync(new URL("./motion.js", import.meta.url), "utf8");
const assetUrl = new URL("./assets/strategy/reperes-cockpit-2x2.webp", import.meta.url);

for (const marker of [
  'id="mandate-collaboration"',
  "Autonomie claire. Décisions explicites. Travail soutenable.",
  "Le silence n’est jamais une approbation.",
  "20 h de communications et 5 h de projets liés ou d’administration",
  'class="project-portfolio-map"',
  'href="#projets-internes"',
  'href="#occasions-a-saisir"',
  ".strategy-mandate-heading > .section-feedback"
]) assert.ok(strategy.includes(marker), `La stratégie clarifiée doit conserver : ${marker}`);

assert.equal((strategy.match(/class="strategy-toc-links"[\s\S]*?<\/nav>/)?.[0].match(/<a /g) || []).length, 8,
  "Le sommaire stratégique doit offrir exactement huit repères stables.");
assert.ok(fs.existsSync(assetUrl), "L’atlas décoratif doit être livré localement avec le cockpit.");
const asset = fs.readFileSync(assetUrl);
assert.ok(asset.length > 20_000 && asset.length < 150_000, "L’atlas doit rester net et léger pour GitHub Pages.");
assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF", "L’atlas doit être un WebP valide.");
assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP", "L’atlas doit être un WebP valide.");

for (const marker of [
  "Comment ça marche ?",
  "📝 1 · Texte",
  "🖼️ 2 · Visuel",
  "✓ 3 · Terminé"
]) assert.ok(cockpitUi.includes(marker), `Le parcours de validation doit conserver : ${marker}`);
for (const marker of ["cockpit-workflow-path", "cockpit-workflow-help", 'data-gate="content"', 'data-gate="media"', 'data-gate="publication"']) {
  assert.ok(clarity.includes(marker), `La feuille de clarté doit conserver : ${marker}`);
}

assert.match(motion, /1400\);/, "L’ondulation doit rester assez lente pour être perçue sans bloquer l’interface.");
assert.match(motion, /cockpit-water-level 4\.8s/, "Le niveau d’eau doit conserver son rythme calme.");
assert.match(motion, /cockpit-soft-water-ripple 1\.3s/, "L’ondulation de confirmation doit rester douce.");

console.log("✓ stratégie, portefeuille, repères visuels et parcours de validation clarifiés");
