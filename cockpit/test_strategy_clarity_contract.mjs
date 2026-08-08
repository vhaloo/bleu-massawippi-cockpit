import assert from "node:assert/strict";
import fs from "node:fs";

const strategy = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const projectDecisions = JSON.parse(fs.readFileSync(new URL("./project_decisions.json", import.meta.url), "utf8"));
const cockpitUi = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const clarity = fs.readFileSync(new URL("./clarity.css", import.meta.url), "utf8");
const motion = fs.readFileSync(new URL("./motion.js", import.meta.url), "utf8");
const assetUrl = new URL("./assets/strategy/reperes-cockpit-2x2.webp", import.meta.url);

for (const marker of [
  'id="mandate-collaboration"',
  'id="site-niveau-lac-rapport-2025"',
  "Niveau du lac et barrage — des repères utiles",
  "station hydrométrique 030241",
  "Étude de préfaisabilité pour l’évaluation du gain potentiel sur les inondations suivant un abaissement du seuil de la crête déversante",
  "Municipalité de Hatley",
  "Comparer à l’historique ↗",
  "Partenariats 2026–2027 · version 11 · 6 pages",
  "la continuité des suivis de la qualité de l’eau et des inventaires",
  "IQDYGqXjZKD2TJ9oS_ZVTgGfAfUOUb7mKILEyhHLVT9dd7A",
  "Autonomie claire. Décisions explicites. Travail soutenable.",
  "Le silence n’est jamais une approbation.",
  "20 h de communications et 5 h de projets liés ou d’administration",
  'class="project-portfolio-map"',
  'href="#projets-internes"',
  'href="#occasions-a-saisir"',
  ".strategy-mandate-heading > .section-feedback",
  'class="cockpit-product-brand"',
  './assets/brand/cockpit-bleu-massawippi-lockup.svg',
  "La règle de diffusion reste sept publications par semaine, une par jour.",
  "✓ 2 · Texte approuvé",
  "🖼️ 4 · Visuel approuvé",
  "🗂️ 6 · Rien ne disparaît",
  "la direction arbitre les décisions institutionnelles"
]) assert.ok(strategy.includes(marker), `La stratégie clarifiée doit conserver : ${marker}`);
const levelDecision = projectDecisions.decisions.find((decision) => decision.id === "site-niveau-lac-rapport-2025-v1");
assert.ok(levelDecision, "La décision de validation du futur encart Niveau du lac doit rester déclarée.");
assert.equal(levelDecision.sourceType, "section", "La décision Niveau du lac doit cibler une section stratégique.");
assert.equal(levelDecision.sourceId, "site-niveau-lac-rapport-2025", "La décision Niveau du lac doit cibler son propre encart, jamais le cadre générique du mandat.");
assert.ok(levelDecision.message.includes("L’attribution à la Municipalité de Hatley et le titre complet ont été vérifiés"),
  "La décision doit distinguer la vérification factuelle déjà faite de la validation éditoriale encore attendue.");
assert.ok(strategy.includes(`id="${levelDecision.sourceId}"`), "Toute décision stratégique doit avoir une destination réelle dans le cockpit.");
assert.ok(!strategy.includes("elle a été demandée par le Village de North Hatley"),
  "L’attribution erronée de l’étude ne doit pas réapparaître.");
assert.ok(!strategy.includes('class="wrap stats"'), "Le bandeau de métriques redondant ne doit pas réapparaître hors de la stratégie.");
assert.match(strategy, /\.strategic-document-card \{[^}]*scroll-margin-top:/,
  "Les raccourcis vers les documents stratégiques doivent laisser leur titre visible sous le menu fixe.");
assert.ok(!strategy.includes("Observer.<br>Comprendre.<br>Agir."), "L’accueil ne doit plus utiliser l’ancien visuel éditorial générique.");
assert.ok(!strategy.includes("publications principales<br>séquence de lancement"), "L’accueil doit présenter un outil durable, pas une séquence de 28 jours.");
assert.ok(!strategy.includes("brand-lake") && !strategy.includes("data-brand-logo-target") && !strategy.includes("Le lac au centre."),
  "L’ancien mélange entre le logo et la forme de lac ne doit pas réapparaître.");
assert.ok(!cockpitUi.includes("installBrandLogo"), "Le logo produit local ne doit plus dépendre d’un téléchargement dynamique OneDrive.");

assert.equal((strategy.match(/class="strategy-toc-links"[\s\S]*?<\/nav>/)?.[0].match(/<a /g) || []).length, 8,
  "Le sommaire stratégique doit offrir exactement huit repères stables.");
assert.ok(fs.existsSync(assetUrl), "L’atlas décoratif doit être livré localement avec le cockpit.");
const asset = fs.readFileSync(assetUrl);
assert.ok(asset.length > 20_000 && asset.length < 150_000, "L’atlas doit rester net et léger pour GitHub Pages.");
assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF", "L’atlas doit être un WebP valide.");
assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP", "L’atlas doit être un WebP valide.");

for (const relative of [
  "./assets/brand/logo-bleu-massawippi-2024.png",
  "./assets/brand/cockpit-bleu-massawippi-lockup.svg",
  "./assets/brand/cockpit-bleu-massawippi-icon-192.png",
  "./assets/brand/cockpit-bleu-massawippi-icon-512.png"
]) assert.ok(fs.existsSync(new URL(relative, import.meta.url)), `L’identité produit doit livrer ${relative}.`);

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
