import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("./sw.js", import.meta.url), "utf8");
const packageFile = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const releaseMatch = worker.match(/const RELEASE = "([^"]+)"/);
const cacheMatch = worker.match(/const CACHE = "bleu-massawippi-cockpit-shell-v(\d+)"/);
assert.ok(releaseMatch, "Le service worker doit déclarer une version de publication explicite.");
assert.ok(cacheMatch && Number(cacheMatch[1]) >= 36, "Le cache public doit être incrémenté après une mutation du shell.");

const release = releaseMatch[1];
for (const resource of ["firebase-config.js", "theme.js", "cockpit-ui.js", "view-mode.js"]) {
  assert.match(index, new RegExp(`${resource.replace(".", "\\.")}\\?v=${release}`), `${resource} doit utiliser la version ${release}.`);
}
const cockpitUi = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const actionItemsUi = fs.readFileSync(new URL("./action-items-ui.js", import.meta.url), "utf8");
assert.match(cockpitUi, new RegExp(`action-items-ui\\.js\\?v=${release}`), "Le module actionItems doit partager la version du shell.");
assert.match(index, /serviceWorker\.register\("\.\/sw\.js", \{ scope: "\.\/" \}\)/,
  "Le service worker doit conserver la portée locale exigée par GitHub Pages.");
for (const resource of ["firebase-config.js", "theme.js", "cockpit-ui.js", "action-items-ui.js", "view-mode.js"]) {
  assert.match(worker, new RegExp(resource.replace(".", "\\.")), `${resource} doit faire partie du shell hors ligne.`);
}
const firebaseVersion = cockpitUi.match(/firebase-client\.js\?v=([^"']+)/)?.[1];
assert.ok(firebaseVersion, "Le module principal doit versionner explicitement le client Firebase.");
assert.match(actionItemsUi, new RegExp(`firebase-client\\.js\\?v=${firebaseVersion}`), "Les deux modules UI doivent partager le même singleton Firebase.");
assert.match(worker, new RegExp(`firebase-client\\.js\\?v=${firebaseVersion}`), "Le shell doit précharger le même singleton Firebase que les modules UI.");
assert.match(worker, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE/, "La purge doit rester limitée aux anciens caches du cockpit.");
assert.match(worker, /event\.request\.method !== "GET"/, "Le cache ne doit jamais intercepter les écritures.");

const testScript = packageFile.scripts?.test || "";
for (const script of ["test:shell", "test:sync", "test:media", "test:view-mode", "test:action-items", "test:contract", "test:quality"]) {
  assert.ok(testScript.includes(`npm run ${script}`), `${script} doit faire partie de npm test.`);
}

console.log(`✓ shell ${release}, cache v${cacheMatch[1]} et suite de régression intégrée`);
