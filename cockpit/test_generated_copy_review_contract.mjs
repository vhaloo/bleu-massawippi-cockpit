import assert from "node:assert/strict";
import fs from "node:fs";

const reconcile = fs.readFileSync(new URL("../tools/reconcile-generated-copy-review.mjs", import.meta.url), "utf8");
const mediaAudit = fs.readFileSync(new URL("../tools/audit-future-media.mjs", import.meta.url), "utf8");
const mediaPreviewApply = fs.readFileSync(new URL("../tools/apply-media-preview-urls.mjs", import.meta.url), "utf8");
const contentNoticeSeed = fs.readFileSync(new URL("../tools/seed-content-notices-rest.mjs", import.meta.url), "utf8");

assert.match(reconcile, /process\.argv\.includes\("--apply"\)/,
  "La réconciliation doit rester en lecture seule sans --apply explicite.");
assert.match(reconcile, /stage === "proposal"/,
  "Seuls les workflows absents ou encore en proposition peuvent avancer automatiquement.");
assert.match(reconcile, /after: "content_review"/,
  "Un texte créé doit devenir prêt côté communications et rester soumis à la direction.");
assert.doesNotMatch(reconcile, /content_approved/,
  "L’outil ne doit jamais fabriquer une approbation finale du texte par la direction.");
assert.match(reconcile, /currentDocument: current \? \{ updateTime: current\.updateTime \} : \{ exists: false \}/,
  "Chaque écriture doit être protégée contre une modification concurrente.");
assert.match(reconcile, /documentRoot}\x2fchangeArchive\/generated-copy-review-/,
  "Chaque transition doit conserver une preuve dans le journal de modifications.");
assert.match(reconcile, /uid: "6FAy9GJU5qTUlHNelXvtHBsVH3k1"/,
  "La recommandation doit être attribuée au compte communications de Valentin.");

assert.doesNotMatch(mediaAudit,
  /media\.publicationBlocked !== true && !\["archived", "reference"\]/,
  "Un média bloqué avant publication demeure une proposition visible et ne doit pas être déclaré absent.");
assert.match(mediaAudit, /localWithoutPublishReadyMedia/,
  "L’audit doit distinguer présence dans le carrousel et aptitude immédiate à publier.");
assert.match(mediaAudit, /productionWithoutPublishReadyMedia/,
  "La même distinction doit être mesurée en production.");

for (const [name, source] of [["réconciliation", reconcile], ["aperçus", mediaPreviewApply], ["nouveautés", contentNoticeSeed]]) {
  assert.match(source, /const documentRoot = `projects\/\$\{PROJECT_ID\}\/databases\/\$\{DATABASE\}\/documents`;/,
    `${name}: les noms de documents d’un commit REST doivent utiliser le nom de ressource Firestore, sans URL.`);
  assert.doesNotMatch(source, /name:\s*`\$\{base\}\/documents\//,
    `${name}: une URL HTTPS ne doit jamais être envoyée dans le champ Write.update.name.`);
}

console.log("Contrat texte préparé / validation direction et couverture média : OK.");
