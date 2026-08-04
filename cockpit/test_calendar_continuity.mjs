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
assert.doesNotMatch(radioCanadaPost.copy, /https?:\/\/ici\.radio-canada\.ca/i,
  "La publication Meta doit rester native et ne pas contenir un lien d’actualité bloqué au Canada.");
assert.match(radioCanadaPost.source, /2442552\/entrevue/,
  "Le lien OHdio doit rester documenté dans la source interne.");
assert.match(`${radioCanadaPost.format} ${radioCanadaPost.fallback} ${radioCanadaPost.task}`, /sans (?:lien|URL).*(?:Facebook|Meta)|(?:Facebook|Meta).*sans (?:lien|URL)/i,
  "Le relais doit expliciter la variante Meta sans URL et le report du lien vers le site.");
assert.match(radioCanadaPost.fallback, /ne pas inventer de citation/i,
  "Le relais doit conserver explicitement la garde contre toute citation inventée.");
const radioCanadaArticle = horizon.find((item) => item.id === "actualite-20260804-article-radio-canada-moules-zebrees");
assert.ok(radioCanadaArticle, "L’article écrit de Radio-Canada doit occuper le 9 août sans remplacer un post terminé.");
assert.equal(radioCanadaArticle.dateIso, "2026-08-09");
assert.doesNotMatch(radioCanadaArticle.copy, /https?:\/\/ici\.radio-canada\.ca/i,
  "La publication Meta de l’article doit rester native et sans lien d’actualité.");
assert.match(radioCanadaArticle.source, /2273213\/moule-zebree-espece-envahissante-lac-massawippi/,
  "Le lien de l’article doit rester documenté dans la source interne.");
assert.match(`${radioCanadaArticle.format} ${radioCanadaArticle.fallback} ${radioCanadaArticle.task}`, /sans (?:lien|URL).*(?:Facebook|Meta)|(?:Facebook|Meta).*sans (?:lien|URL)/i,
  "Le relais écrit doit expliciter la variante Meta sans URL et le report du lien vers le site.");
assert.ok(!/2442552\/entrevue/.test(radioCanadaArticle.copy), "Le relais écrit doit rester distinct de l’entrevue OHdio.");
const articleMedia = manifests.filter((item) => item.eventId === radioCanadaArticle.id);
assert.equal(articleMedia.length, 1, "Le relais écrit doit proposer un seul visuel actif clairement identifiable.");
assert.equal(articleMedia[0].id, "editorial-actualite-20260809-denis-citation-science-v2");
assert.ok(articleMedia[0].previewUrl, "Le portrait de Denis et sa citation doivent avoir un aperçu mobile réel.");
assert.match(`${articleMedia[0].note || ""} ${articleMedia[0].rightsStatus || ""}`, /Denis Petitclerc/i,
  "Le portrait actif doit conserver l’attribution de Denis et la provenance de la photographie.");
assert.match(articleMedia[0].note || "", /La science évolue\./,
  "La citation fournie doit être documentée avec sa dernière phrase exacte.");
const archivedArticleMedia = JSON.parse(fs.readFileSync(path.join(here, "editorial_media_manifest.json"), "utf8"))
  .find((item) => item.id === "editorial-actualite-20260804-radio-canada-article-v1");
assert.equal(archivedArticleMedia?.stage, "archived", "L’ancien visuel aux moules doit être archivé sans être supprimé.");
assert.equal(archivedArticleMedia?.archived, true);
const editorialManifest = JSON.parse(fs.readFileSync(path.join(here, "editorial_media_manifest.json"), "utf8"));
const archivedSyntheticFieldPhoto = editorialManifest.find((item) => item.id === "editorial-s4d1b-field-details-v2");
assert.equal(archivedSyntheticFieldPhoto?.stage, "archived", "L’essai photoréaliste ne doit jamais être présenté comme une photo de terrain réelle.");
assert.equal(archivedSyntheticFieldPhoto?.archived, true);
assert.match(archivedSyntheticFieldPhoto?.rightsStatus || "", /non documentaire/i);
const trueFieldPhoto = editorialManifest.find((item) => item.id === "editorial-s4d1b-field-internal-photo-v3");
assert.equal(trueFieldPhoto?.stage, "proposal", "La véritable photo interne doit rester la proposition active.");
assert.equal(trueFieldPhoto?.publicationBlocked, true, "Les personnes visibles doivent être autorisées avant programmation.");
assert.match(trueFieldPhoto?.note || "", /20220510_115415\.jpg/);
const summerFridge = editorialManifest.find((item) => item.id === "editorial-s3d6-fridge-summer-dji0227-v2");
assert.equal(summerFridge?.stage, "proposal", "Le souvenir de vacances doit rester une proposition active.");
assert.match(summerFridge?.note || "", /DJI_0227\.JPG/,
  "Le souvenir de vacances doit utiliser la nouvelle photographie interne encore inutilisée.");
const restoredCompletedSlot = posts.find((item) => item.id === "alt-20260731");
assert.equal(restoredCompletedSlot?.dateIso, "2026-08-04", "Le post déjà programmé doit être restauré au 4 août.");
assert.equal(restoredCompletedSlot?.displacedBy, null);
const deferredRaindrop = posts.find((item) => item.id === "s4d5");
assert.equal(deferredRaindrop?.dateIso, "2026-09-15", "Le voyage d’une goutte de pluie doit être conservé au créneau libéré.");
assert.equal(deferredRaindrop?.displacedBy, radioCanadaArticle.id);
const deferredMonitoringPost = posts.find((item) => item.id === "s1d2");
assert.equal(deferredMonitoringPost?.dateIso, "2026-09-14", "Le suivi du lac et de ses tributaires doit être conservé au 14 septembre.");

console.log(JSON.stringify({ passed: true, start, end, days: expectedDates.length, publications: horizon.length, gaps: 0, duplicates: 0, newPosts: newIds.length }, null, 2));
