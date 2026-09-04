import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const linksDirectory = path.resolve(process.env.COCKPIT_MEDIA_LINKS_DIR || path.join(here, "secrets"));
const specs = [
  ["editorial_media_manifest.json", "editorial-media-links.json"],
  ["historical_media_manifest.json", "historical-media-links.json"],
  ["nature_media_manifest.json", "nature-media-links.json"]
];
const sharePointPattern = /^https:\/\/bleumassawippi\.sharepoint\.com\/(?:(?::(?:i|v):\/g\/)|Documents%20partages\/)/;
const previewPrefix = "https://vhaloo.github.io/bleu-massawippi-cockpit/";
const requireRegistryCoverage = process.argv.includes("--require-registry-coverage");
const manifests = [];
const mediaUiSource = fs.readFileSync(path.join(here, "clarity.css"), "utf8");
assert.match(mediaUiSource, /\.cockpit-media-card\[data-media-id="editorial-don-20260911-community-gauge-v3"\] \.cockpit-media-preview \{ aspect-ratio:2 \/ 3; grid-template-rows:minmax\(0, 1fr\); \}/, "La jauge verticale doit être visible en entier, sans changer le cadrage des autres médias.");
assert.match(mediaUiSource, /\.cockpit-media-card\[data-media-id="editorial-don-20260911-community-gauge-v3"\] \.cockpit-media-preview img \{ min-height:0; \}/);
const registries = new Map();
let availableRegistries = 0;

for (const [manifestName, registryName] of specs) {
  const manifestPath = path.join(here, manifestName);
  const registryPath = path.join(linksDirectory, registryName);
  assert.ok(fs.existsSync(manifestPath), `Manifeste absent : ${manifestName}`);
  if (requireRegistryCoverage) assert.ok(fs.existsSync(registryPath), `Registre privé absent : ${registryPath}`);
  const entries = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : null;
  if (registry) availableRegistries += 1;
  assert.ok(Array.isArray(entries), `${manifestName} doit contenir une liste.`);
  manifests.push(...entries.map((entry) => ({ ...entry, manifestName })));
  registries.set(manifestName, registry);
}

const activeEntries = manifests.filter((entry) => entry.archived !== true);
const ids = new Set();
const missingLinks = [];
const invalidLinks = [];
const missingPreviews = [];
const emptyPreviews = [];
let reuseCount = 0;
let previewCount = 0;

for (const entry of activeEntries) {
  assert.match(String(entry.id || ""), /^[A-Za-z0-9_-]{3,160}$/, `Identifiant média invalide dans ${entry.manifestName}.`);
  assert.ok(!ids.has(entry.id), `Identifiant média actif dupliqué : ${entry.id}`);
  ids.add(entry.id);
  assert.ok(String(entry.eventId || "").length >= 3, `Événement absent pour ${entry.id}.`);
  assert.ok(String(entry.label || "").trim(), `Libellé absent pour ${entry.id}.`);

  if (entry.reuseMediaId) {
    reuseCount += 1;
  } else {
    const registry = registries.get(entry.manifestName);
    const url = registry?.[entry.fileName];
    if (!url) missingLinks.push(`${entry.id} (${entry.fileName})`);
    else if (!sharePointPattern.test(url)) invalidLinks.push(`${entry.id} (${entry.fileName})`);
  }

  if (entry.previewUrl) {
    previewCount += 1;
    if (entry.previewUrl.startsWith(previewPrefix)) {
      const relativePath = decodeURIComponent(entry.previewUrl.slice(previewPrefix.length)).replaceAll("/", path.sep);
      const previewPath = path.join(here, relativePath);
      if (!fs.existsSync(previewPath)) missingPreviews.push(`${entry.id} (${relativePath})`);
      else if (fs.statSync(previewPath).size < 100) emptyPreviews.push(`${entry.id} (${relativePath})`);
    }
  }
}

if (requireRegistryCoverage) {
  assert.deepEqual(missingLinks, [], `Liens SharePoint manquants du registre local :\n${missingLinks.join("\n")}`);
}
assert.deepEqual(invalidLinks, [], `Liens SharePoint invalides :\n${invalidLinks.join("\n")}`);
assert.deepEqual(missingPreviews, [], `Aperçus locaux manquants :\n${missingPreviews.join("\n")}`);
assert.deepEqual(emptyPreviews, [], `Aperçus locaux vides :\n${emptyPreviews.join("\n")}`);

console.log(JSON.stringify({
  passed: true,
  manifests: specs.length,
  privateRegistriesAvailable: availableRegistries,
  activeMedia: activeEntries.length,
  registeredSharePointLinks: activeEntries.length - reuseCount - missingLinks.length,
  registryCoveragePending: missingLinks.length,
  registryCoverageRequired: requireRegistryCoverage,
  reusedMediaReferences: reuseCount,
  localPreviewsVerified: previewCount,
  invalidRegisteredLinks: 0,
  missingPreviews: 0
}, null, 2));
