import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts } from "./plan-overrides.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, "..", "index.html"), "utf8");
const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
assert.ok(postsJson, "Le calendrier source doit rester lisible.");

const posts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const start = "2026-07-29";
const end = "2026-09-13";
const horizon = posts.filter((post) => post.archivedEditorial !== true && post.dateIso >= start && post.dateIso <= end);
const byDate = Object.groupBy(horizon, (post) => post.dateIso);
const expectedDates = [];
for (const cursor = new Date(`${start}T12:00:00Z`); cursor <= new Date(`${end}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
  expectedDates.push(cursor.toISOString().slice(0, 10));
}

assert.equal(horizon.length, 47, "La période demandée doit contenir 47 publications actives.");
assert.deepEqual(Object.keys(byDate).sort(), expectedDates, "Aucune date du 29 juillet au 13 septembre ne doit être vide.");
assert.ok(Object.values(byDate).every((items) => items.length === 1), "Chaque journée doit contenir exactement une publication active.");
assert.ok(horizon.every((post) => post.choiceRequired !== true && !post.optionGroup), "Les anciens choix séparés doivent devenir des dates autonomes.");

const manifests = ["historical_media_manifest.json", "nature_media_manifest.json", "editorial_media_manifest.json"]
  .flatMap((file) => JSON.parse(fs.readFileSync(path.join(here, file), "utf8")))
  .filter((media) => media.archived !== true && media.stage !== "archived" && media.stage !== "reference");
for (const post of horizon) {
  assert.ok(manifests.some((media) => media.eventId === post.id), `Un média explicite doit être prévu pour ${post.id}.`);
}

const newIds = [
  "don-20260909-appel-soutien",
  "nature-20260910-feuille-surface",
  "don-20260911-merci-bilan",
  "archives-20260912-vos-images",
  "quiz-20260913-trois-gestes"
];
for (const id of newIds) {
  const post = horizon.find((item) => item.id === id);
  assert.ok(post, `La nouvelle publication ${id} doit être planifiée.`);
  assert.match(post.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/);
  assert.ok(post.copy.length <= 2200);
  const media = manifests.filter((item) => item.eventId === id);
  assert.equal(media.length, 1);
  assert.ok(media[0].previewUrl, `L’aperçu réel de ${id} doit être disponible sur mobile.`);
}

const radioCanadaPost = horizon.find((item) => item.id === "actualite-20260808-denis-radio-canada-moules-zebrees");
assert.ok(radioCanadaPost, "Le relais Radio-Canada doit occuper le 8 août sans créer de doublon.");
assert.equal(radioCanadaPost.dateIso, "2026-08-08");
assert.match(radioCanadaPost.copy, /2442552\/entrevue/);
assert.ok(!/«[^»]+»/.test(radioCanadaPost.copy), "Le relais ne doit pas inventer de citation attribuée à Denis.");
const radioCanadaArticle = horizon.find((item) => item.id === "actualite-20260804-article-radio-canada-moules-zebrees");
assert.ok(radioCanadaArticle, "L’article écrit de Radio-Canada doit occuper le 9 août sans remplacer un post terminé.");
assert.equal(radioCanadaArticle.dateIso, "2026-08-09");
assert.match(radioCanadaArticle.copy, /2273213\/moule-zebree-espece-envahissante-lac-massawippi/);
assert.ok(!/2442552\/entrevue/.test(radioCanadaArticle.copy), "Le relais écrit doit rester distinct de l’entrevue OHdio.");
const articleMedia = manifests.filter((item) => item.eventId === radioCanadaArticle.id);
assert.equal(articleMedia.length, 1, "Le relais écrit doit proposer une seule photographie clairement identifiable.");
assert.ok(articleMedia[0].previewUrl, "La photographie recadrée de l’article doit avoir un aperçu mobile réel.");
assert.match(`${articleMedia[0].note || ""} ${articleMedia[0].rightsStatus || ""}`, /Radio-Canada/i,
  "La provenance Radio-Canada et le crédit doivent accompagner la photographie.");
const restoredCompletedSlot = posts.find((item) => item.id === "alt-20260731");
assert.equal(restoredCompletedSlot?.dateIso, "2026-08-04", "Le post déjà programmé doit être restauré au 4 août.");
assert.equal(restoredCompletedSlot?.displacedBy, null);
const deferredRaindrop = posts.find((item) => item.id === "s4d5");
assert.equal(deferredRaindrop?.dateIso, "2026-09-15", "Le voyage d’une goutte de pluie doit être conservé au créneau libéré.");
assert.equal(deferredRaindrop?.displacedBy, radioCanadaArticle.id);
const deferredMonitoringPost = posts.find((item) => item.id === "s1d2");
assert.equal(deferredMonitoringPost?.dateIso, "2026-09-14", "Le suivi du lac et de ses tributaires doit être conservé au 14 septembre.");

console.log(JSON.stringify({ passed: true, start, end, days: expectedDates.length, publications: horizon.length, gaps: 0, duplicates: 0, newPosts: newIds.length }, null, 2));
