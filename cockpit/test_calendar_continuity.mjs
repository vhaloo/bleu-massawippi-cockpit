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
const start = "2026-07-13";
const end = "2026-09-29";
const historicalStart = "2026-07-13";
const historicalEnd = "2026-08-16";
const historicalDates = [];
for (const cursor = new Date(`${historicalStart}T12:00:00Z`); cursor <= new Date(`${historicalEnd}T12:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
  historicalDates.push(cursor.toISOString().slice(0, 10));
}
const cadenceWeeks = [
  ["2026-08-17", "2026-08-18", "2026-08-20", "2026-08-21", "2026-08-23"],
  ["2026-08-24", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"],
  ["2026-09-01", "2026-09-02", "2026-09-04", "2026-09-05", "2026-09-06"],
  ["2026-09-07", "2026-09-08", "2026-09-10", "2026-09-12", "2026-09-13"],
  ["2026-09-14", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-20"],
  ["2026-09-22", "2026-09-23", "2026-09-25", "2026-09-26", "2026-09-27"]
];
const eventReminderWeek = cadenceWeeks[1];
const postEventThanksDate = "2026-08-31";
const postEventThanksWeek = cadenceWeeks[2];
const regularCadenceWeeks = cadenceWeeks.filter((_, index) => index !== 1 && index !== 2);
const preparedBankDates = ["2026-09-28", "2026-09-29"];
const expectedDates = [...historicalDates, ...cadenceWeeks.flat(), postEventThanksDate, ...preparedBankDates].sort();
const horizon = posts.filter((post) => post.archivedEditorial !== true && post.dateIso >= start && post.dateIso <= end);
const byDate = Object.groupBy(horizon, (post) => post.dateIso);

assert.equal(horizon.length, expectedDates.length, "Le calendrier doit conserver l’historique quotidien puis appliquer exactement les créneaux de la nouvelle cadence.");
assert.deepEqual(Object.keys(byDate).sort(), expectedDates, "Les dates actives doivent correspondre exactement à l’historique protégé, aux créneaux réguliers et au rappel exceptionnel de l’événement.");
assert.ok(Object.values(byDate).every((items) => items.length === 1), "Chaque créneau retenu doit contenir exactement une publication active.");
assert.ok(horizon.every((post) => post.choiceRequired !== true && !post.optionGroup), "Les anciens choix séparés doivent devenir des dates autonomes.");
assert.ok(regularCadenceWeeks.every((week) => week.length === 5), "Chaque semaine régulière à compter du 17 août doit contenir cinq publications.");
assert.equal(eventReminderWeek.length, 6, "La semaine de l’événement doit ajouter uniquement le rappel du dimanche à la cadence régulière.");
assert.ok(cadenceWeeks.every((week) => week.every((date) => byDate[date]?.length === 1)), "Tous les créneaux retenus doivent être occupés une seule fois.");
assert.equal(byDate[postEventThanksDate]?.length, 1, "Le remerciement post-événement du 31 août doit occuper un créneau unique.");
assert.equal(postEventThanksWeek.filter((date) => byDate[date]?.length === 1).length + byDate[postEventThanksDate].length, 6,
  "La semaine du 31 août doit conserver cinq créneaux réguliers et le remerciement explicitement demandé.");
const weekdaySignatures = regularCadenceWeeks.map((week) => week.map((date) => new Date(`${date}T12:00:00Z`).getUTCDay()).join("-"));
assert.ok(new Set(weekdaySignatures).size > 1, "Les jours de diffusion doivent varier d’une semaine à l’autre.");

const manifests = ["historical_media_manifest.json", "nature_media_manifest.json", "editorial_media_manifest.json"]
  .flatMap((file) => JSON.parse(fs.readFileSync(path.join(here, file), "utf8")))
  .filter((media) => media.archived !== true && media.stage !== "archived" && media.stage !== "reference");
for (const post of horizon.filter((item) => item.dateIso >= "2026-07-29")) {
  assert.ok(manifests.some((media) => media.eventId === post.id), `Un média explicite doit être prévu pour ${post.id}.`);
}

const newIds = [
  "poesie-20260821-invitation-public",
  "poesie-20260829-rappel-demain",
  "poesie-20260830-rappel-aujourdhui",
  "poesie-20260831-remerciement-public-artistes",
  "don-20260909-appel-soutien",
  "nature-20260910-feuille-surface",
  "don-20260911-merci-bilan",
  "don-20260918-point-soutien",
  "archives-20260912-vos-images",
  "quiz-20260913-trois-gestes",
  "photo-20260915-soir-automne"
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

const fundingCheckpoints = [
  ["don-20260909-appel-soutien", "2026-08-28"],
  ["don-20260911-merci-bilan", "2026-09-04"],
  ["don-20260918-point-soutien", "2026-09-18"]
];
for (const [id, dateIso] of fundingCheckpoints) {
  const post = horizon.find((item) => item.id === id);
  assert.equal(post?.dateIso, dateIso, `${id} doit occuper son vendredi aux deux semaines.`);
  assert.equal(new Date(`${dateIso}T12:00:00Z`).getUTCDay(), 5, `${dateIso} doit être un vendredi.`);
  assert.equal(post?.donationCadence, "biweekly-friday-update");
  assert.equal(post?.publicationBlocked, true, "Un point financier doit rester bloqué tant que le total et sa date ne sont pas confirmés.");
  assert.deepEqual(post?.requiredPlaceholders, ["[DATE DE VÉRIFICATION]", "[MONTANT TOTAL CONFIRMÉ]", "[VERIFICATION DATE]", "[CONFIRMED CAMPAIGN TOTAL]"]);
  assert.match(post?.copy || "", /zeffy\.com\/fr-CA/);
  assert.match(post?.copy || "", /zeffy\.com\/en-CA/);
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
assert.equal(trueFieldPhoto?.publicationBlocked, false, "La confirmation explicite des droits doit lever le blocage de programmation.");
assert.match(trueFieldPhoto?.rightsStatus || "", /photographie interne Bleu Massawippi/i);
assert.match(trueFieldPhoto?.note || "", /Droits de diffusion confirmés par les communications le 10 août 2026/i);
assert.match(trueFieldPhoto?.note || "", /20220510_115415\.jpg/);
const summerFridge = editorialManifest.find((item) => item.id === "editorial-s3d6-fridge-summer-dji0227-v2");
assert.equal(summerFridge?.stage, "proposal", "Le souvenir de vacances doit rester une proposition active.");
assert.match(summerFridge?.note || "", /DJI_0227\.JPG/,
  "Le souvenir de vacances doit utiliser la nouvelle photographie interne encore inutilisée.");
const restoredCompletedSlot = posts.find((item) => item.id === "alt-20260731");
assert.equal(restoredCompletedSlot?.dateIso, "2026-08-04", "Le post déjà programmé doit être restauré au 4 août.");
assert.equal(restoredCompletedSlot?.displacedBy, null);
const deferredRaindrop = posts.find((item) => item.id === "s4d5");
assert.equal(deferredRaindrop?.dateIso, "2026-08-20", "Le voyage d’une goutte de pluie doit être conservé dans la première semaine de la nouvelle cadence.");
assert.equal(deferredRaindrop?.displacedBy, null);
const irisPost = posts.find((item) => item.id === "s2d1");
assert.equal(irisPost?.dateIso, "2026-08-16", "L’iris doit occuper le dimanche proposé par la direction.");
const waterLilyPost = posts.find((item) => item.id === "alt-20260805");
assert.equal(waterLilyPost?.dateIso, "2026-09-02", "Le nénuphar doit être reporté assez loin pour diversifier la séquence.");
const rejectedSharedSpace = posts.find((item) => item.id === "alt-20260725");
assert.equal(rejectedSharedSpace?.archivedEditorial, true, "L’angle éditorial refusé doit être archivé sans suppression.");
const deferredMonitoringPost = posts.find((item) => item.id === "s1d2");
assert.equal(deferredMonitoringPost?.dateIso, "2026-09-27", "Le suivi du lac et de ses tributaires doit être conservé au 27 septembre.");
const advancedLivingShorelinePost = posts.find((item) => item.id === "alt-20260723");
assert.equal(advancedLivingShorelinePost?.dateIso, "2026-09-01", "La capsule approuvée sur la rive doit remplacer le contenu reporté le 1er septembre.");
assert.notEqual(advancedLivingShorelinePost?.publicationBlocked, true, "La publication de remplacement déjà approuvée doit rester publiable.");
const fundingDeferredPost = posts.find((item) => item.id === "alt-20260724");
assert.equal(fundingDeferredPost?.dateIso, "2026-09-30", "Le contenu en attente du financement doit être conservé au dernier créneau disponible.");
assert.equal(fundingDeferredPost?.publicationBlocked, true, "Le contenu reporté doit rester bloqué jusqu’à confirmation explicite du financement.");
assert.equal(fundingDeferredPost?.requiresFundingReadyConfirmation, true);
assert.match(fundingDeferredPost?.blockedReason || "", /financement est prêt/i);
const deferredSeasonalEssentials = posts.find((item) => item.id === "alt-20260714");
assert.equal(deferredSeasonalEssentials?.dateIso, "2026-09-28", "La capsule du samedi doit être conservée au prochain créneau libre sans collision.");
const poetryInvitation = posts.find((item) => item.id === "poesie-20260821-invitation-public");
assert.equal(poetryInvitation?.dateIso, "2026-08-21", "L’invitation Au bord du bleu doit remplacer le point de soutien le 21 août.");
assert.doesNotMatch(poetryInvitation?.copy || "", /13 h 40|13 h 42|1:40 p\.m\.|1:42 p\.m\./i);
const poetryTomorrow = posts.find((item) => item.id === "poesie-20260829-rappel-demain");
const poetryToday = posts.find((item) => item.id === "poesie-20260830-rappel-aujourdhui");
assert.equal(poetryTomorrow?.dateIso, "2026-08-29");
assert.equal(poetryToday?.dateIso, "2026-08-30");
assert.match(poetryTomorrow?.copy || "", /c’est demain!/i);
assert.match(poetryToday?.copy || "", /c’est aujourd’hui!/i);
for (const reminder of [poetryTomorrow, poetryToday]) {
  assert.match(reminder?.copy || "", /Parc Lôbadanaki/);
  assert.match(reminder?.copy || "", /13 h à 16 h/);
  assert.match(reminder?.copy || "", /1–4 p\.m\./);
  assert.doesNotMatch(reminder?.copy || "", /13 h 40|13 h 42|1:40 p\.m\.|1:42 p\.m\.|repli|church/i);
}

console.log(JSON.stringify({ passed: true, start, end, historicalDaysPreserved: historicalDates.length, regularCadenceWeeks: regularCadenceWeeks.length, postsPerRegularWeek: 5, eventReminderWeekPosts: eventReminderWeek.length, futureScheduledPosts: cadenceWeeks.flat().length + preparedBankDates.length, replacementOnSeptember1: advancedLivingShorelinePost.id, deferredFundingPostDate: fundingDeferredPost.dateIso, publications: horizon.length, gapsOnChosenSlots: 0, duplicates: 0, fundingCheckpoints: fundingCheckpoints.length, newPosts: newIds.length }, null, 2));
