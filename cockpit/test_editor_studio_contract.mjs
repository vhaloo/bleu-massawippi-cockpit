import assert from "node:assert/strict";
import fs from "node:fs";

const studio = fs.readFileSync(new URL("./editor-studio.js", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("./firebase-client.js", import.meta.url), "utf8");
const rules = fs.readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("./sw.js", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

assert.match(studio, /profile\?\.role !== "admin"/, "Le Studio doit rester invisible hors du compte des communications.");
assert.match(studio, /Nouvelle publication non enregistrée/);
assert.match(studio, /Dupliquer/);
assert.match(studio, /Identifiant automatique/);
assert.match(studio, /data-field="id"[\s\S]*readonly[\s\S]*aria-readonly="true"/,
  "L’identifiant doit être généré sans saisie manuelle.");
assert.match(studio, /resolvePublicationId/);
assert.match(studio, /stableId/);
assert.match(studio, /mustCreate: creating/,
  "Une création doit refuser atomiquement une collision tardive.");
assert.match(studio, /Classer sans supprimer/);
assert.match(studio, /Restaurer crée une nouvelle version/);
assert.match(studio, /data-field="copy"[\s\S]*maxlength="10000"/);
assert.match(studio, /data-field="tasksValentin"/);
assert.match(studio, /data-field="tasksAnnie"/);
assert.equal((studio.match(/runtime\.panel\.querySelector\("\[data-studio-revision\]"\)/g) || []).length, 2,
  "L’ouverture et l’enregistrement doivent mettre à jour la version dans l’en-tête du panneau.");
assert.doesNotMatch(studio, /runtime\.form\.querySelector\("\[data-studio-revision\]"\)/,
  "L’étiquette de version est hors du formulaire et ne doit jamais être cherchée dans celui-ci.");
assert.doesNotMatch(studio, /deleteDoc|removeDoc|eval\(|new Function/, "Le Studio ne doit ni supprimer physiquement ni exécuter du code arbitraire.");

assert.match(client, /export async function savePublicationContent/);
assert.match(client, /runTransaction\(db/);
assert.match(client, /currentRevision !== Number\(expectedRevision/);
assert.match(client, /mustCreate && snapshot\.exists\(\)/,
  "Une collision apparue entre l’affichage et l’enregistrement ne doit jamais écraser une publication.");
assert.match(client, /changeArchiveEntry\(\s*"publicationContent"/);
assert.match(client, /export async function fetchPublicationHistory/);
assert.match(rules, /isAdmin\(\)[\s\S]*request\.resource\.data\.editorial\.revision/,
  "Une révision éditoriale doit exiger le rôle admin et une version séquentielle.");
assert.match(rules, /allow delete: if false;/);

for (const file of ["section-navigation.js", "publication-editor-schema.mjs", "editor-studio.js"]) {
  assert.ok(worker.includes(file), `${file} doit être disponible hors ligne.`);
  assert.ok(workflow.includes(`cp cockpit/${file} public/`), `${file} doit être livré par GitHub Pages.`);
}

console.log("✓ Studio : admin seulement, versionné, archivé et livré sans exécution arbitraire");
