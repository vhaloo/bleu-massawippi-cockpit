import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("./sw.js", import.meta.url), "utf8");
const refresher = fs.readFileSync(new URL("./actualiser.html", import.meta.url), "utf8");
const packageFile = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const deploymentWorkflow = fs.readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

const releaseMatch = worker.match(/const RELEASE = "([^"]+)"/);
const cacheMatch = worker.match(/const CACHE = "bleu-massawippi-cockpit-shell-v(\d+)"/);
assert.ok(releaseMatch, "Le service worker doit déclarer une version de publication explicite.");
assert.ok(cacheMatch && Number(cacheMatch[1]) >= 36, "Le cache public doit être incrémenté après une mutation du shell.");

const release = releaseMatch[1];
for (const resource of ["firebase-config.js", "theme.js", "motion.js", "cockpit-ui.js", "view-mode.js"]) {
  assert.match(index, new RegExp(`${resource.replace(".", "\\.")}\\?v=${release}`), `${resource} doit utiliser la version ${release}.`);
}
const cockpitUi = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const actionItemsUi = fs.readFileSync(new URL("./action-items-ui.js", import.meta.url), "utf8");
const healthUi = fs.readFileSync(new URL("./client-health-ui.js", import.meta.url), "utf8");
const adminLazyUi = fs.readFileSync(new URL("./admin-lazy-data.js", import.meta.url), "utf8");
const mediaChoiceUi = fs.readFileSync(new URL("./media-choice-ui.js", import.meta.url), "utf8");
const taskProgressUi = fs.readFileSync(new URL("./task-progress-ui.js", import.meta.url), "utf8");
assert.match(cockpitUi, new RegExp(`action-items-ui\\.js\\?v=${release}`), "Le module actionItems doit partager la version du shell.");
const taskProgressImport = cockpitUi.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/task-progress-ui\.js\?v=[^"']+["']/s);
assert.ok(taskProgressImport, "Le module principal doit importer explicitement les aides de progression.");
for (const importedName of taskProgressImport[1].split(",").map((name) => name.trim()).filter(Boolean)) {
  assert.match(taskProgressUi, new RegExp(`export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+${importedName}\\b`),
    `task-progress-ui.js doit réellement exporter ${importedName}.`);
}
assert.match(index, /serviceWorker\.register\("\.\/sw\.js", \{ scope: "\.\/", updateViaCache: "none" \}\)/,
  "Le service worker doit conserver la portée locale exigée par GitHub Pages.");
assert.match(index, /registration\.update\(\)/, "Chaque ouverture doit vérifier la coque sans attendre le cache HTTP de GitHub Pages.");
assert.match(index, /controllerchange/, "La PWA doit détecter l’activation d’une nouvelle coque.");
assert.match(index, /Actualiser maintenant/, "Une session active doit proposer une actualisation explicite plutôt que perdre une saisie.");
assert.match(deploymentWorkflow, /cp cockpit\/actualiser\.html public\//, "La remise à neuf PWA doit faire partie de l’artefact Pages.");
assert.match(deploymentWorkflow, /cp -R cockpit\/media-previews public\/media-previews/, "Les aperçus média légers doivent faire partie de l’artefact Pages.");
assert.match(cockpitUi, /href="\.\/actualiser\.html" data-refresh-cockpit/, "Le pied de page doit conserver un accès humain à la remise à neuf.");
assert.match(cockpitUi, /function safeMediaPreviewUrl\(value\)/,
  "Les aperçus optimisés doivent passer par une liste d’autorisation dédiée.");
assert.match(cockpitUi, /p\.hostname\.toLowerCase\(\) === "vhaloo\.github\.io"/,
  "Les aperçus publics doivent rester limités à l’hôte GitHub Pages du cockpit.");
assert.match(cockpitUi, /p\.pathname\.startsWith\("\/bleu-massawippi-cockpit\/media-previews\/"\)/,
  "La liste d’autorisation ne doit accepter que le répertoire public des aperçus légers.");
assert.match(refresher, /bleu-massawippi-cockpit-shell-/, "La remise à neuf doit limiter la purge aux caches du cockpit.");
assert.match(refresher, /registration\.scope\.startsWith\(baseUrl\.href\)/, "La remise à neuf ne doit désinscrire que les workers de cette application.");
assert.match(refresher, /destination\.searchParams\.set\("fresh"/, "La réouverture doit contourner le cache HTTP avec une URL unique.");
assert.doesNotMatch(refresher, /indexedDB\.(deleteDatabase|databases)|localStorage\.clear|sessionStorage\.clear/, "La remise à neuf ne doit effacer ni session, ni préférences, ni cache Firestore.");
for (const resource of ["firebase-config.js", "theme.js", "motion.js", "cockpit-ui.js", "event-context-data.js", "action-items-ui.js", "client-health-ui.js", "admin-lazy-data.js", "media-choice-ui.js", "task-progress-ui.js", "view-mode.js"]) {
  assert.match(worker, new RegExp(resource.replace(".", "\\.")), `${resource} doit faire partie du shell hors ligne.`);
  assert.match(deploymentWorkflow, new RegExp(`cp cockpit/${resource.replace(".", "\\.")} public/`), `${resource} doit faire partie de l’artefact GitHub Pages.`);
}
const firebaseVersion = cockpitUi.match(/firebase-client\.js\?v=([^"']+)/)?.[1];
assert.ok(firebaseVersion, "Le module principal doit versionner explicitement le client Firebase.");
assert.match(actionItemsUi, new RegExp(`firebase-client\\.js\\?v=${firebaseVersion}`), "Les deux modules UI doivent partager le même singleton Firebase.");
assert.match(healthUi, new RegExp(`firebase-client\\.js\\?v=${firebaseVersion}`), "Le diagnostic doit partager le même singleton Firebase.");
assert.match(adminLazyUi, new RegExp(`firebase-client\\.js\\?v=${firebaseVersion}`), "Le chargement paresseux doit partager le même singleton Firebase.");
assert.ok(worker.includes("`./firebase-client.js?v=${RELEASE}`") || new RegExp(`firebase-client\\.js\\?v=${firebaseVersion}`).test(worker),
  "Le shell doit précharger le même singleton Firebase que les modules UI.");
assert.match(worker, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE/, "La purge doit rester limitée aux anciens caches du cockpit.");
assert.match(worker, /event\.request\.method !== "GET"/, "Le cache ne doit jamais intercepter les écritures.");
assert.match(worker, /shellRequest \? \{ cache:"no-store" \} : undefined/, "Les navigations et modules doivent contourner le cache HTTP périmé quand le réseau répond.");
assert.match(worker, /postMessage\(\{ type:"cockpit-update-ready", release:RELEASE \}\)/, "Le nouveau worker doit prévenir les fenêtres déjà ouvertes.");

const testScript = packageFile.scripts?.test || "";
for (const script of ["test:shell", "test:motion-install", "test:resilience", "test:sync", "test:media", "test:view-mode", "test:action-items", "test:contract", "test:quality"]) {
  assert.ok(testScript.includes(`npm run ${script}`), `${script} doit faire partie de npm test.`);
}

console.log(`✓ shell ${release}, cache v${cacheMatch[1]} et suite de régression intégrée`);
