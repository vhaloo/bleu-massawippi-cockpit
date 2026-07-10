const fs = require("node:fs/promises");
const path = require("node:path");

const workspaceDir = __dirname;
const sourcePath = path.join(workspaceDir, "index.html");
 (async () => {
const source = await fs.readFile(sourcePath, "utf8");
const layoutVersion = "2026-07-10";
const marker = `data-layout-version="${layoutVersion}"`;

function sectionBlock(id, html) {
  const match = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`));
  if (!match) throw new Error(`Section introuvable : ${id}`);
  return match[0];
}

const readme = `
<details id="readme-collapsible" class="readme-fold" data-readme-version="${layoutVersion}" open>
 <summary><span>Lire-moi — collaborer dans le cockpit</span><small>Réduire / afficher</small></summary>
 <div class="readme-body">
  <p class="readme-kicker">Point de départ</p>
  <h2>Un espace de travail asynchrone, clair et réversible.</h2>
  <p>Ce cockpit rassemble le cap, les choix éditoriaux et le calendrier de Bleu Massawippi. Il sert à lire, commenter, arbitrer et préparer la prochaine mouture; il ne publie rien automatiquement.</p>
  <div class="readme-grid">
   <article class="readme-step"><b>1 · Se connecter</b><span>Ouvrir une session avec le compte autorisé. Le rôle de la session détermine les actions disponibles.</span></article>
   <article class="readme-step"><b>2 · Lire et choisir</b><span>Parcourir le contexte, puis sélectionner une seule option lorsqu’une journée propose deux angles.</span></article>
   <article class="readme-step"><b>3 · Donner une direction</b><span>Utiliser les statuts, les badges rapides, le champ de commentaire ou le micro. La dictée demande l’autorisation du microphone.</span></article>
   <article class="readme-step"><b>4 · Rétroagir au bon niveau</b><span>Chaque section possède une case Avis / recommandation. La boîte à idées flottante sert aux améliorations générales du cockpit.</span></article>
   <article class="readme-step"><b>5 · Suivre les décisions</b><span>Les changements sont consignés dans le journal technique visible au rôle d’administration; une prochaine mouture est préparée après arbitrage.</span></article>
   <article class="readme-step"><b>6 · Ajouter un rendez-vous</b><span>Le bouton d’agenda génère un fichier calendrier compatible avec l’application choisie sur l’appareil, notamment sur mobile.</span></article>
  </div>
  <div class="workflow-label">Flux de travail proposé</div>
  <svg class="workflow-svg" data-workflow-svg viewBox="0 0 920 270" role="img" aria-labelledby="workflow-title workflow-description">
   <title id="workflow-title">Cycle de collaboration asynchrone</title>
   <desc id="workflow-description">Une idée devient un contenu déposé, arbitré, vérifié, programmé puis mesuré. Les apprentissages reviennent dans le dépôt.</desc>
   <defs><marker id="workflow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2ab6bb"></path></marker></defs>
   <g class="workflow-lines" fill="none" stroke="#2ab6bb" stroke-width="3" marker-end="url(#workflow-arrow)">
    <path d="M174 109 H198"></path><path d="M354 109 H378"></path><path d="M534 109 H558"></path><path d="M714 109 H738"></path>
    <path d="M828 153 C828 232 282 248 282 153"></path>
   </g>
   <g class="workflow-node">
    <rect x="14" y="70" width="160" height="78" rx="16"></rect><text x="94" y="100" text-anchor="middle"><tspan x="94" dy="0">Idée / plan</tspan><tspan x="94" dy="22">un objectif</tspan></text>
    <rect x="198" y="70" width="160" height="78" rx="16"></rect><text x="278" y="100" text-anchor="middle"><tspan x="278" dy="0">Dépôt</tspan><tspan x="278" dy="22">asynchrone</tspan></text>
    <rect x="382" y="70" width="160" height="78" rx="16"></rect><text x="462" y="100" text-anchor="middle"><tspan x="462" dy="0">Arbitrage</tspan><tspan x="462" dy="22">direction</tspan></text>
    <rect x="566" y="70" width="160" height="78" rx="16"></rect><text x="646" y="100" text-anchor="middle"><tspan x="646" dy="0">Relecture</tspan><tspan x="646" dy="22">et production</tspan></text>
    <rect x="750" y="70" width="160" height="78" rx="16"></rect><text x="830" y="100" text-anchor="middle"><tspan x="830" dy="0">Diffusion</tspan><tspan x="830" dy="22">et lecture</tspan></text>
   </g>
   <text class="workflow-return" x="555" y="245" text-anchor="middle">apprentissages → prochaine mouture</text>
  </svg>
  <p class="readme-note"><strong>Règle simple :</strong> on peut déposer une idée sans interrompre l’autre personne; une décision sensible est explicitement signalée; la diffusion reste conditionnelle à la validation prévue dans le calendrier.</p>
 </div>
</details>`;

if (source.includes(marker)) {
  console.log(JSON.stringify({ updated: false, reason: "layout déjà intégré", marker }));
  process.exit(0);
}

const ids = ["cap", "cadence", "collaboration", "validation"];
const blocks = Object.fromEntries(ids.map((id) => [id, sectionBlock(id, source)]));
let updated = source;
for (const id of ids) updated = updated.replace(blocks[id], "");
updated = updated
  .replace("Explorer les 28 jours", "Voir le calendrier")
  .replace('<nav class="nav"><div class="wrap"><a href="#cap">Cap</a>', '<nav class="nav"><div class="wrap"><a href="#readme-collapsible">Lire-moi</a><a href="#collaboration">Collaboration</a><a href="#cap">Cap</a>')
  .replace('<main class="wrap">', `<main class="wrap">\n<details id="context-collapsible" class="context-fold" data-layout-version="${layoutVersion}" open>\n <summary><span>Contexte stratégique et collaboration</span><small>Réduire / afficher</small></summary>\n <div class="context-body">${readme}${blocks.collaboration}${blocks.cap}${blocks.cadence}${blocks.validation}\n </div>\n</details>`, 1);

await fs.writeFile(sourcePath, updated, "utf8");
console.log(JSON.stringify({ updated: sourcePath, layoutVersion, sections: ids, readme: true, workflowSvg: true }));
 })();
