import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts, CADENCE_5_POLICY, preparePlanScript } from "./plan-overrides.js";
import { BILINGUAL_POLICY_VERSION, FUTURE_EDITORIAL_IDS, TONE_VERSION } from "./editorial-copy-overrides.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ui = fs.readFileSync(path.join(here, "cockpit-ui.js"), "utf8");
const calendarExport = fs.readFileSync(path.join(here, "calendar-export-tools.js"), "utf8");
const sectionNavigation = fs.readFileSync(path.join(here, "section-navigation.js"), "utf8");
const taskProgressUi = fs.readFileSync(path.join(here, "task-progress-ui.js"), "utf8");
const monthlySnapshotState = fs.readFileSync(path.join(here, "monthly-snapshot-state.js"), "utf8");
const viewMode = fs.readFileSync(path.join(here, "view-mode.js"), "utf8");
const viewFixture = fs.readFileSync(path.join(here, "test-fixtures", "view-mode.html"), "utf8");
const aug5CarouselFixture = fs.readFileSync(path.join(here, "test-fixtures", "aug5-media-carousel.html"), "utf8");
const client = fs.readFileSync(path.join(here, "firebase-client.js"), "utf8");
const theme = fs.readFileSync(path.join(here, "theme.js"), "utf8");
const firebaseConfig = fs.readFileSync(path.join(here, "firebase-config.js"), "utf8");
const firestoreRules = fs.readFileSync(path.join(here, "firestore.rules"), "utf8");
const privateContentSeed = fs.readFileSync(path.join(here, "seed_private_content.js"), "utf8");
const poetryReminderCliSync = fs.readFileSync(path.join(here, "sync_poetry_reminders_cli_rest_20260827.mjs"), "utf8");
const internalProjectSeed = fs.readFileSync(path.join(here, "seed_internal_project_states.js"), "utf8");
const adminSync = fs.readFileSync(path.join(here, "admin_sync.js"), "utf8");
const meetingBriefBuilder = fs.readFileSync(path.join(root, "tools", "build_poetry_meeting_brief.py"), "utf8");
const mediaSeedSources = ["seed_nature_media_links.js", "seed_editorial_media_links.js", "seed_historical_media_links.js"].map((file) => ({
  file,
  source: fs.readFileSync(path.join(here, file), "utf8")
}));
const natureMediaSeed = mediaSeedSources.find(({ file }) => file === "seed_nature_media_links.js").source;
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
const historicalMedia = JSON.parse(fs.readFileSync(path.join(here, "historical_media_manifest.json"), "utf8"));
const natureMedia = JSON.parse(fs.readFileSync(path.join(here, "nature_media_manifest.json"), "utf8"));
const editorialMedia = JSON.parse(fs.readFileSync(path.join(here, "editorial_media_manifest.json"), "utf8"));
const internalProjectDocuments = JSON.parse(fs.readFileSync(path.join(here, "internal_project_documents.json"), "utf8"));
const projectCalendarEvents = JSON.parse(fs.readFileSync(path.join(here, "project_calendar_events.json"), "utf8"));
const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
assert.ok(postsJson, "Le tableau des publications source doit rester lisible.");
assert.match(aug5CarouselFixture, /Carrousel « Hier et aujourd’hui »/);
assert.match(aug5CarouselFixture, /north-hatley-1930-1950-preview\.webp/);
assert.match(aug5CarouselFixture, /north-hatley-2024-preview\.webp/);
assert.match(aug5CarouselFixture, /choisissez les 2 cartes/);
const posts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const activePosts = posts.filter((post) => post.archivedEditorial !== true);
const plannedMedia = [...historicalMedia, ...natureMedia, ...editorialMedia].filter((media) => media.archived !== true && media.stage !== "archived" && media.stage !== "reference");
assert.ok(activePosts.every((post) => /^2026-\d{2}-\d{2}$/.test(post.dateIso || "")), "Chaque publication active doit avoir une date ISO canonique.");
assert.ok(posts.every((post) => /^2026-\d{2}-\d{2}$/.test(post.dateIso || "")), "Chaque document planifié ou archivé envoyé à Firestore doit conserver une date ISO canonique.");
for (const post of posts) {
  assert.ok(Array.isArray(post.tasksValentin) && post.tasksValentin.length > 0, `La publication ${post.id} doit conserver les responsabilités des communications.`);
  assert.ok(Array.isArray(post.tasksAnnie), `La publication ${post.id} doit définir explicitement les responsabilités de la direction, même lorsque la liste est vide.`);
  assert.ok(post.taskOwnersVersion, `La publication ${post.id} doit versionner sa répartition des responsabilités.`);
  assert.equal(post.tasksValentinMinutes.length, post.tasksValentin.length, `La publication ${post.id} doit estimer chaque tâche des communications.`);
  assert.equal(post.tasksAnnieMinutes.length, post.tasksAnnie.length, `La publication ${post.id} doit estimer chaque tâche de la direction.`);
  assert.ok(post.tasksValentinMinutes.every((minutes) => Number.isInteger(minutes) && minutes > 0));
  assert.ok(post.tasksAnnieMinutes.every((minutes) => Number.isInteger(minutes) && minutes > 0));
}
assert.deepEqual(
  Object.fromEntries(posts.filter((post) => post.archivedEditorial === true).map((post) => [post.id, post.dateIso])),
  { s1d1b: "2026-07-13", s2d3: "2026-07-22", s2d6: "2026-07-26", s3d1b: "2026-07-27", "alt-20260804": "2026-08-04", "alt-20260810": "2026-08-10", "alt-20260725": "2026-08-27" },
  "Les archives éditoriales doivent conserver leur date d’origine pour rester modifiables sous les règles Firestore."
);
for (const post of activePosts.filter((post) => post.dateIso >= "2026-07-22")) {
  assert.ok(plannedMedia.some((media) => media.eventId === post.id), `La publication future ${post.id} doit avoir au moins une proposition média explicite, même si sa diffusion exige encore une validation.`);
}
const editorialCycleAug12Posts = Object.fromEntries(
  ["s2d1", "s4d2", "alt-20260718", "alt-20260721", "alt-20260723", "alt-20260724"].map((id) => [id, activePosts.find((post) => post.id === id)])
);
assert.match(editorialCycleAug12Posts.s2d1.copy, /plante indigène des milieux humides/,
  "La capsule sur l’iris doit intégrer l’information écologique demandée par la direction.");
assert.doesNotMatch(editorialCycleAug12Posts.s2d1.copy, /garder le souvenir d’un iris|remember an iris/,
  "La phrase écartée par la direction ne doit plus apparaître dans la capsule sur l’iris.");
assert.match(editorialCycleAug12Posts["alt-20260718"].copy, /Quel détail vous intrigue\?/,
  "La question de la capsule naturaliste doit reprendre la formulation retenue par la direction.");
assert.match(editorialCycleAug12Posts.s4d2.copy, /Naviguer sur le lac, c’est vivre ensemble/,
  "La publication sur le partage du lac doit intégrer la formulation proposée par la direction le 12 août.");
assert.match(editorialCycleAug12Posts["alt-20260721"].copy, /précieux indicateur de la santé d’un lac/,
  "La capsule sur le huard doit expliquer son rôle d’indicateur écologique.");
assert.match(editorialCycleAug12Posts["alt-20260721"].source, /parcs\.canada\.ca[\s\S]*canada\.ca/,
  "L’ajout scientifique sur le huard doit rester appuyé par des sources publiques primaires.");
assert.match(editorialCycleAug12Posts["alt-20260723"].visual, /Photographie documentaire réelle/,
  "La nouvelle proposition de rive doit privilégier une photographie authentique distincte.");
assert.equal(editorialCycleAug12Posts["alt-20260724"].title, "Le bassin versant relie le paysage",
  "L’atelier non financé doit être remplacé sans laisser de trou dans le calendrier.");
assert.doesNotMatch(editorialCycleAug12Posts["alt-20260724"].copy, /atelier|workshop/i,
  "La publication de remplacement ne doit pas publiciser l’atelier reporté.");
assert.equal(editorialCycleAug12Posts["alt-20260723"].dateIso, "2026-09-01",
  "La capsule approuvée sur la rive doit occuper le mardi 1er septembre.");
assert.notEqual(editorialCycleAug12Posts["alt-20260723"].publicationBlocked, true,
  "Le remplacement déjà approuvé du 1er septembre doit rester publiable.");
assert.equal(editorialCycleAug12Posts["alt-20260724"].dateIso, "2026-10-18",
  "La publication en attente du financement doit être repoussée au dernier créneau courant.");
assert.equal(editorialCycleAug12Posts["alt-20260724"].publicationBlocked, true,
  "La publication reportée ne doit pas revenir en diffusion avant confirmation du financement.");
assert.match(editorialCycleAug12Posts["alt-20260724"].blockedReason || "", /financement est prêt/i);
const twiceOverriddenFundingPost = applyPlanOverridesToPosts(applyPlanOverridesToPosts(JSON.parse(postsJson)))
  .find((post) => post.id === "alt-20260724");
assert.equal(
  twiceOverriddenFundingPost.tasksValentin.filter((task) => /confirmation explicite que le financement est prêt/i.test(task)).length,
  1,
  "Le garde-fou financement doit rester unique même lorsque le plan est préparé plusieurs fois."
);
const editorialCycleAug12Media = editorialMedia.filter((media) => ["s3d7", "alt-20260723", "alt-20260724"].includes(media.eventId));
for (const mediaId of [
  "editorial-s3d7-five-gentle-real-photo-v2",
  "editorial-alt-20260723-living-shore-real-photo-v2",
  "editorial-alt-20260724-watershed-real-photo-v1"
]) {
  const media = editorialCycleAug12Media.find((item) => item.id === mediaId);
  assert.ok(media && media.archived !== true && media.stage !== "archived", `Le nouveau média ${mediaId} doit rester proposé et visible.`);
  assert.ok(media.previewUrl, `Le nouveau média ${mediaId} doit conserver un aperçu léger dans le cockpit.`);
}
assert.equal(
  editorialMedia.filter((media) => media.eventId === "alt-20260724" && /rain-garden/.test(media.id)).every((media) => media.archived === true && media.stage === "archived"),
  true,
  "Les deux visuels de l’atelier reporté doivent rester conservés, mais classés aux archives."
);
assert.deepEqual(
  activePosts.map((post) => post.dateIso),
  [...activePosts].map((post) => post.dateIso).sort(),
  "Le calendrier doit rester trié chronologiquement après tous les déplacements."
);
for (const week of [1,2,3,4,5,6,7,8,9,10,11,12]) {
  const dates = [...new Set(activePosts.filter((post) => post.w === week).map((post) => post.dateIso))];
  assert.deepEqual(dates, [...dates].sort(), `La semaine ${week} doit suivre l’ordre réel des dates.`);
}
assert.equal(CADENCE_5_POLICY.effectiveFrom, "2026-08-17");
assert.equal(CADENCE_5_POLICY.postsPerCompleteWeek, 5);
const protectedHistoricalDates = [];
for (const cursor = new Date("2026-07-13T12:00:00Z"); cursor <= new Date("2026-08-16T12:00:00Z"); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
  const date = cursor.toISOString().slice(0, 10);
  if (date !== "2026-08-07") protectedHistoricalDates.push(date);
}
const cadenceWeeks = [
  ["2026-08-17", "2026-08-18", "2026-08-20", "2026-08-21", "2026-08-23"],
  ["2026-08-24", "2026-08-26", "2026-08-27", "2026-08-29", "2026-08-30"],
  ["2026-09-01", "2026-09-02", "2026-09-04", "2026-09-05", "2026-09-06"],
  ["2026-09-07", "2026-09-08", "2026-09-10", "2026-09-12", "2026-09-13"],
  ["2026-09-14", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-20"],
  ["2026-09-22", "2026-09-23", "2026-09-25", "2026-09-26", "2026-09-27"]
];
const eventReminderWeek = cadenceWeeks[1];
const postEventThanksDate = "2026-08-31";
const postEventThanksWeek = cadenceWeeks[2];
const regularCadenceWeeks = cadenceWeeks.filter((_, index) => index !== 1 && index !== 2);
const expectedContinuityDates = [...protectedHistoricalDates, ...cadenceWeeks.flat(), postEventThanksDate, "2026-09-28", "2026-09-29", "2026-10-02", "2026-10-16", "2026-10-18"].sort();
const activePostsByDate = Object.groupBy(activePosts, (post) => post.dateIso);
assert.deepEqual(Object.keys(activePostsByDate).sort(), expectedContinuityDates,
  "Le calendrier actif doit préserver l’historique quotidien, la cadence régulière et les deux rappels demandés pour Au bord du bleu.");
assert.ok(Object.values(activePostsByDate).every((items) => items.length === 1),
  "Chaque créneau actif doit afficher exactement une publication.");
assert.ok(regularCadenceWeeks.every((week) => week.length === CADENCE_5_POLICY.postsPerCompleteWeek && week.every((date) => activePostsByDate[date]?.length === 1)),
  "Chaque semaine régulière à compter du 17 août doit contenir exactement cinq publications.");
assert.equal(eventReminderWeek.length, 5, "Les cinq publications réellement diffusées restent en place après le report du bilan non publié.");
assert.ok(eventReminderWeek.every((date) => activePostsByDate[date]?.length === 1), "Les créneaux de la semaine événementielle doivent rester uniques.");
assert.equal(activePostsByDate[postEventThanksDate]?.length, 1, "Le remerciement post-événement du 31 août doit occuper son propre créneau.");
assert.equal(postEventThanksWeek.filter((date) => activePostsByDate[date]?.length === 1).length + activePostsByDate[postEventThanksDate].length, 6,
  "La semaine du 31 août doit conserver cinq créneaux réguliers et le remerciement explicitement demandé.");
assert.equal(activePosts.length, 70, "Le calendrier doit conserver 35 publications historiques, 32 publications sur la période de cadence et trois publications préparées en banque.");
const continuityPostIds = [
  "poesie-20260821-invitation-public",
  "poesie-20260829-rappel-demain",
  "poesie-20260830-rappel-aujourdhui",
  "poesie-20260831-remerciement-public-artistes",
  "don-20260909-appel-soutien",
  "nature-20260910-feuille-surface",
  "don-20260911-merci-bilan",
  "don-20260918-point-soutien",
  "archives-20260912-vos-images",
  "quiz-20260913-trois-gestes"
];
for (const id of continuityPostIds) {
  const post = activePosts.find((item) => item.id === id);
  assert.ok(post, `La publication de continuité ${id} doit exister.`);
  assert.match(post.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/,
    `La publication de continuité ${id} doit être bilingue.`);
  assert.ok(post.copy.length <= 2200, `La publication de continuité ${id} doit respecter la limite Meta.`);
  const media = editorialMedia.filter((item) => item.eventId === id && !["archived", "reference"].includes(item.stage) && item.archived !== true);
  const keepsSelectedOriginal = id === "don-20260911-merci-bilan";
  assert.equal(media.length, keepsSelectedOriginal ? 2 : 1, `La publication de continuité ${id} doit conserver ses variantes attendues.`);
  if (keepsSelectedOriginal) assert.deepEqual(media.map(item => item.id).sort(), ["editorial-don-20260911-community-gauge-v3", "editorial-don-20260911-community-photo-v2"]);
  assert.ok(media.every(item => item.previewUrl), `Chaque média de ${id} doit afficher un vrai aperçu mobile.`);
  assert.ok(media.every(item => item.fileName), `Chaque média de ${id} doit identifier son fichier source.`);
}
const aug24FeedbackCases = [
  {
    eventId: "nature-20260910-feuille-surface",
    activeMediaId: "editorial-nature-20260910-beaver-real-v2",
    archivedMediaId: "editorial-nature-20260910-water-lily-v1",
    assetDate: "2026-09-23",
    titlePattern: /castor, architecte des milieux humides/i,
    copyPattern: /une branche fraîchement rongée[\s\S]*Denali/i,
    rightsPattern: /domaine public[\s\S]*NPS \/ Mary Lewandowski/i
  },
  {
    eventId: "archives-20260912-vos-images",
    activeMediaId: "editorial-archives-20260912-pilsen-night-real-v2",
    archivedMediaId: "editorial-archives-20260912-album-v1",
    assetDate: "2026-09-25",
    titlePattern: /Une photo peut réveiller toute une histoire/i,
    copyPattern: /Pub Pilsen[\s\S]*rivière Massawippi/i,
    rightsPattern: /Guerinf[\s\S]*CC0/i
  },
  {
    eventId: "quiz-20260913-trois-gestes",
    activeMediaId: "editorial-quiz-20260913-kayak-real-v2",
    archivedMediaId: "editorial-quiz-20260913-three-steps-v1",
    assetDate: "2026-09-26",
    titlePattern: /Quiz du lac : les trois gestes qui voyagent bien/i,
    copyPattern: /Nettoyer[\s\S]*Vider[\s\S]*Sécher/i,
    rightsPattern: /domaine public[\s\S]*NPS \/ Andrew Cattoir/i
  }
];
for (const feedbackCase of aug24FeedbackCases) {
  const post = activePosts.find((item) => item.id === feedbackCase.eventId);
  const activeMedia = editorialMedia.find((item) => item.id === feedbackCase.activeMediaId);
  const archivedMedia = editorialMedia.find((item) => item.id === feedbackCase.archivedMediaId);
  assert.match(post?.title || "", feedbackCase.titlePattern,
    `${feedbackCase.eventId} doit intégrer le cadrage éditorial demandé par la direction le 24 août.`);
  assert.match(post?.copy || "", feedbackCase.copyPattern,
    `${feedbackCase.eventId} doit intégrer le texte correspondant à son nouveau visuel réel.`);
  assert.equal(activeMedia?.eventId, feedbackCase.eventId);
  assert.equal(activeMedia?.stage, "proposal");
  assert.equal(activeMedia?.publicationBlocked, false);
  assert.match(activeMedia?.rightsStatus || "", feedbackCase.rightsPattern);
  assert.equal(archivedMedia?.stage, "archived",
    `${feedbackCase.archivedMediaId} doit rester conservé sans demeurer sélectionnable.`);
  assert.equal(archivedMedia?.archived, true);
  const previewName = activeMedia.previewUrl.split("/").at(-1);
  for (const assetName of [activeMedia.fileName, previewName]) {
    assert.ok(fs.existsSync(path.join(here, "media-previews", feedbackCase.assetDate, assetName)),
      `Le fichier ${assetName} doit être livré avec le cockpit.`);
  }
}
const pilsenMedia = editorialMedia.find((item) => item.id === "editorial-archives-20260912-pilsen-night-real-v2");
assert.equal(pilsenMedia?.reuseMediaId, "history-2025-55-rue-main-north-hatley-pub-pilsen",
  "Le visuel nocturne du Pilsen doit conserver le lien vers la photographie historique déjà documentée.");
const eveningPhoto = activePosts.find((post) => post.id === "photo-20260915-soir-automne");
assert.match(eveningPhoto?.copy || "", /Elle nous rappelle qu’un lieu n’est jamais identique : il se transforme avec le temps, les saisons et nos yeux\./,
  "La phrase française doit reprendre exactement la formulation demandée par la direction le 24 août.");
assert.doesNotMatch(eveningPhoto?.copy || "", /un même lieu ne se regarde jamais tout à fait deux fois/i,
  "L’ancienne formulation française ne doit plus apparaître.");
for (const [eventId, freshMediaId] of [
  ["don-20260911-merci-bilan", "editorial-don-20260911-community-photo-v2"],
  ["don-20260918-point-soutien", "editorial-don-20260918-community-photo-v2"]
]) {
  const freshMedia = editorialMedia.find((item) => item.id === freshMediaId);
  assert.equal(freshMedia?.eventId, eventId, `${freshMediaId} doit rester lié au bon point soutien.`);
  assert.equal(freshMedia?.reuseMediaId, undefined, `${freshMediaId} doit être un visuel frais, pas une réutilisation.`);
  assert.match(freshMedia?.label || "", /Proposition finale/, `${freshMediaId} doit être présenté comme prêt à choisir.`);
  const retainedReferences = editorialMedia.filter((item) => item.eventId === eventId && item.stage === "reference");
  assert.ok(retainedReferences.length >= 1, `${eventId} doit conserver l’ancienne image comme référence.`);
  assert.ok(retainedReferences.every((item) => item.publicationBlocked === true), `${eventId} ne doit pas permettre de sélectionner une référence.`);
}
const fridayThanksMedia = editorialMedia.find((item) => item.id === "editorial-don-20260821-thanks-fridge-v2");
assert.equal(fridayThanksMedia?.eventId, "don-20260909-appel-soutien", "Le frigo de remerciement reporté doit rester lié au point de soutien du vendredi 28 août.");
assert.equal(fridayThanksMedia?.stage, "proposal", "Le nouveau frigo doit rester une proposition révisable.");
assert.equal(fridayThanksMedia?.publicationBlocked, true, "Le média du 28 août ne doit pas lever le blocage financier de la publication.");
assert.match(fridayThanksMedia?.label || "", /Proposition finale/);
assert.match(fridayThanksMedia?.altText || "", /Merci pour vos dons.*Thank you for your donation/i);
assert.match(fridayThanksMedia?.note || "", /reportée du vendredi 21 au vendredi 28 août/i);
const poetryInvitation = activePosts.find((post) => post.id === "poesie-20260821-invitation-public");
assert.equal(poetryInvitation?.dateIso, "2026-08-21");
assert.match(poetryInvitation?.copy || "", /13 poètes et artistes de la parole/i);
assert.match(poetryInvitation?.copy || "", /13 h à 16 h/);
assert.match(poetryInvitation?.copy || "", /1–4 p\.m\./);
assert.doesNotMatch(poetryInvitation?.copy || "", /13 h 40|13 h 42|1:40 p\.m\.|1:42 p\.m\./i,
  "L’heure formelle interne ne doit jamais apparaître dans l’invitation publique.");
assert.doesNotMatch(poetryInvitation?.copy || "", /En cas de pluie.*église|In case of rain.*church/i,
  "L’invitation publique ne doit pas présenter l’église comme lieu de repli tant que ce choix n’est pas confirmé.");
const poetryInvitationMedia = editorialMedia.find((item) => item.id === "editorial-poesie-20260821-invitation-v8");
assert.equal(poetryInvitationMedia?.eventId, poetryInvitation?.id);
assert.match(poetryInvitationMedia?.fileName || "", /v8-evenement-bilingue\.png$/);
assert.equal(poetryInvitationMedia?.stage, "proposal");
const poetryTomorrow = activePosts.find((post) => post.id === "poesie-20260829-rappel-demain");
const poetryToday = activePosts.find((post) => post.id === "poesie-20260830-rappel-aujourdhui");
assert.equal(poetryTomorrow?.dateIso, "2026-08-29");
assert.equal(poetryToday?.dateIso, "2026-08-30");
assert.match(poetryTomorrow?.copy || "", /c’est demain!/i);
assert.match(poetryToday?.copy || "", /c’est aujourd’hui!/i);
for (const reminder of [poetryTomorrow, poetryToday]) {
  assert.match(reminder?.copy || "", /Parc Lôbadanaki/);
  assert.match(reminder?.copy || "", /Entrée libre/);
  assert.doesNotMatch(reminder?.copy || "", /13 h 40|13 h 42|1:40 p\.m\.|1:42 p\.m\.|repli|church/i);
}
for (const [eventId, mediaId] of [
  ["poesie-20260829-rappel-demain", "editorial-poesie-20260829-rappel-demain-v8"],
  ["poesie-20260830-rappel-aujourdhui", "editorial-poesie-20260830-rappel-aujourdhui-v8"]
]) {
  const reminderMedia = editorialMedia.find((item) => item.id === mediaId);
  assert.equal(reminderMedia?.eventId, eventId);
  assert.equal(reminderMedia?.reuseMediaId, "editorial-poesie-20260821-invitation-v8");
  assert.equal(reminderMedia?.publicationBlocked, false);
}
const poetryThanks = activePosts.find((post) => post.id === "poesie-20260831-remerciement-public-artistes");
assert.equal(poetryThanks?.dateIso, "2026-08-31");
assert.equal(poetryThanks?.w, 8);
assert.equal(poetryThanks?.publicationBlocked, false);
assert.ok((poetryThanks?.copy || "").length <= 2200, "Le remerciement bilingue doit rester sous 2 200 caractères.");
for (const artist of [
  "Elisabeth Levac", "Heidi Monk", "Douce Sévigny", "Myriam Bouchard", "Florence Morin", "Fabrice Larue",
  "François Louis Laurin", "Malaurie Champagne", "Mélissa Connolly Soprano", "Marianne Lacharité-Lemieux",
  "Karrie Parent", "Normand Delinelle", "Heather Ross", "Sanctuary", "Denis Petitclerc", "Valentin Wittwe"
]) {
  assert.match(poetryThanks?.copy || "", new RegExp(artist), `Le remerciement doit conserver ${artist}.`);
}
assert.match(poetryThanks?.copy || "", /autrices et auteurs qui ont partagé leurs propres mots/,
  "Le texte français doit distinguer les créations originales.");
assert.match(poetryThanks?.copy || "", /interprètes qui ont prêté leur voix à des œuvres d’autres auteurs/,
  "Le texte français doit distinguer les lectures, chants et interprétations d’autres œuvres.");
assert.match(poetryThanks?.copy || "", /Denis Petitclerc, président de Bleu Massawippi/);
assert.match(poetryThanks?.copy || "", /Valentin Wittwe, directeur des communications/);
assert.match(poetryThanks?.copy || "", /Valentin Wittwe, directeur des communications, qui a lu \*Sanctuary\* au nom de Heather Ross/);
assert.match(poetryThanks?.copy || "", /communications director Valentin Wittwe, who read \*Sanctuary\* on Heather Ross’s behalf/);
const [poetryThanksFr = "", poetryThanksEn = ""] = String(poetryThanks?.copy || "").split("=========================================");
assert.equal((poetryThanksFr.match(/\bValentin\b/g) || []).length, 1,
  "Le remerciement français doit nommer Valentin une seule fois.");
assert.equal((poetryThanksEn.match(/\bValentin\b/g) || []).length, 1,
  "Le remerciement anglais doit nommer Valentin une seule fois.");
assert.match(poetryThanks?.copy || "", /Marimay Loubier Photographe/);
assert.doesNotMatch(JSON.stringify(poetryThanks || {}), /photos\.app\.goo\.gl|Google Photos/i,
  "Le lien de l’album est réservé à la consultation interne dans Codex.");
const poetryThanksMedia = editorialMedia.find((item) => item.id === "editorial-poesie-20260831-remerciement-groupe-v1");
assert.equal(poetryThanksMedia?.eventId, poetryThanks?.id);
assert.equal(poetryThanksMedia?.fileName, "au-bord-du-bleu-photo-groupe-remerciement-2026-08-31.png");
assert.equal(poetryThanksMedia?.publicationBlocked, false);
assert.match(poetryThanksMedia?.label || "", /Visuel retenu par les communications/);
assert.match(poetryThanksMedia?.previewUrl || "", /\/media-previews\/2026-08-31\/au-bord-du-bleu-photo-groupe-remerciement-2026-08-31-preview\.jpg$/,
  "L’aperçu doit utiliser le répertoire public autorisé par le Cockpit.");
assert.doesNotMatch(JSON.stringify(poetryThanksMedia || {}), /photos\.app\.goo\.gl|Google Photos/i,
  "Le manifeste du Cockpit ne doit pas exposer le lien de l’album interne.");
const poetryThanksOriginalPath = path.join(here, "assets", "projects", "poesie-du-lac", poetryThanksMedia.fileName);
const poetryThanksPreviewPath = path.join(here, "media-previews", "2026-08-31", "au-bord-du-bleu-photo-groupe-remerciement-2026-08-31-preview.jpg");
assert.ok(fs.existsSync(poetryThanksOriginalPath), "La photographie originale de remerciement doit être conservée.");
assert.ok(fs.statSync(poetryThanksOriginalPath).size > 100_000, "La photographie originale doit contenir de vraies données.");
assert.ok(fs.existsSync(poetryThanksPreviewPath), "L’aperçu public du remerciement doit exister.");
assert.ok(fs.statSync(poetryThanksPreviewPath).size > 100_000, "L’aperçu public doit contenir de vraies données.");
const previousFridayThanksMedia = editorialMedia.find((item) => item.id === "editorial-don-20260909-souvenir-v1");
assert.equal(previousFridayThanksMedia?.stage, "reference", "L’ancienne base du point soutien doit rester conservée comme référence.");
assert.equal(previousFridayThanksMedia?.publicationBlocked, true, "L’ancienne référence ne doit pas être sélectionnable.");
for (const [id, dateIso] of [["don-20260909-appel-soutien", "2026-10-16"], ["don-20260911-merci-bilan", "2026-09-04"], ["don-20260918-point-soutien", "2026-09-18"]]) {
  const checkpoint = activePosts.find((post) => post.id === id);
  assert.equal(checkpoint?.dateIso, dateIso);
  const reconciled = id === "don-20260911-merci-bilan";
  assert.equal(checkpoint?.publicationBlocked, !reconciled, "Les points futurs sans relevé doivent rester bloqués.");
  assert.deepEqual(checkpoint?.requiredPlaceholders, reconciled ? [] : ["[DATE DE VÉRIFICATION]", "[MONTANT TOTAL CONFIRMÉ]", "[VERIFICATION DATE]", "[CONFIRMED CAMPAIGN TOTAL]"]);
  if (reconciled) {
    assert.equal(checkpoint.donationSnapshot.total, 39526);
    assert.equal(checkpoint.donationSnapshot.goal, 127115);
    assert.equal(checkpoint.donationSnapshot.remaining, 127115 - 39526);
    assert.equal(checkpoint.donationSnapshot.progressPercent, Math.round(39526 / 127115 * 1000) / 10);
    assert.equal(checkpoint.donationSnapshot.includesMatchingContribution, false);
    assert.equal(checkpoint.donationSnapshot.matchingContributionReceived, 0);
    assert.match(checkpoint.copy, /n’inclut pas encore la contrepartie[\s\S]*does not yet include the matching contribution/);
    assert.doesNotMatch(checkpoint.copy, /contrepartie[^.]*incluse|including donations, memberships and matching contributions/i);
    const gauge = editorialMedia.find(item => item.id === "editorial-don-20260911-community-gauge-v3");
    assert.equal(gauge.eventId, id);
    assert.deepEqual(gauge.donationGraphic, {asOf: "2026-09-04", currency: "CAD", total: 39526, goal: 127115, remaining: 87589, progressPercent: 31.1, includesMatchingContribution: false, sourceMediaId: "editorial-don-20260911-community-photo-v2"});
    assert.equal(gauge.publicationBlocked, true, "Le fichier publié avec la mention intégrée périmée doit rester visible comme preuve, mais ne plus être réutilisable.");
    assert.equal(gauge.stage, "published");
    assert.equal(gauge.correctionStatus, "embedded-matching-mention-outdated-do-not-reuse");
    assert.ok(editorialMedia.some(item => item.id === gauge.donationGraphic.sourceMediaId), "Le visuel choisi d’origine doit rester conservé.");
    assert.ok(editorialMedia.some(item => item.id === "editorial-don-20260911-lake-real-v1"), "L’ancienne référence doit également rester conservée.");
    assert.ok(fs.existsSync(path.join(here, "media-previews", "2026-09-04", "point-soutien-jauge-39526-20260904-v3-preview.webp")));
  }
  assert.equal(checkpoint?.donationCadence, "biweekly-friday-update");
}
assert.match(activePosts.find((post) => post.id === "quiz-20260913-trois-gestes").copy, /https:\/\/bleumassawippi\.com\/quiz/);
const first = posts.find((post) => post.id === "s1d1");
const moved = posts.find((post) => post.id === "s1d1b");
const volunteer = posts.find((post) => post.id === "s1d3");
const firstTuesday = posts.find((post) => post.id === "s1d3b");

assert.equal(first.title, "Nous sommes là, si vous voulez nous parler");
assert.doesNotMatch(first.title + first.copy + first.visual, /portes ouvertes/i);
assert.match(first.copy, /Cette semaine, une personne de l’équipe sera au local/i);
assert.doesNotMatch(first.copy, /Ce n’est pas une activité|disponibilités changeront chaque semaine/i);
assert.equal(first.choiceRequired, false);
assert.equal(first.date, "Lundi 13 juillet");
assert.equal(moved.date, "Archive éditoriale");
assert.equal(moved.dateIso, "2026-07-13");
assert.equal(moved.w, 98);
assert.equal(moved.archivedEditorial, true);
assert.equal(moved.archived, true);
assert.equal(volunteer.date, "Mardi 22 septembre");
assert.equal(volunteer.w, 11);
assert.equal(volunteer.coordinationLevel, "high");
assert.equal(volunteer.requiresHumanConsent, true);
assert.equal(volunteer.requiresContactOwnership, true);
assert.equal(volunteer.coordinationDecisionMinutesAnnie, 15);
assert.ok(volunteer.tasksValentin.length >= 5);
assert.ok(volunteer.tasksAnnie.length >= 4);
assert.ok(volunteer.tasksAnnie.some((task) => /premier contact/i.test(task)));
assert.ok(volunteer.tasksAnnie.some((task) => /coordonn/i.test(task)));
assert.ok(volunteer.tasksAnnie.some((task) => /consentement/i.test(task)));
assert.equal(firstTuesday.choiceRequired, false, "La proposition retenue du mardi est verrouillée et ne demande plus d’arbitrage.");
assert.equal(firstTuesday.optionGroup, null, "Une proposition verrouillée ne doit plus appartenir à un groupe de choix actif.");
assert.equal(posts.filter((post) => !post.isAlternative).length, 46);
assert.equal(posts.length, 77);
const radioCanadaArticle = posts.find((post) => post.id === "actualite-20260804-article-radio-canada-moules-zebrees");
assert.ok(radioCanadaArticle, "Le nouvel article écrit de Radio-Canada doit devenir une publication distincte.");
assert.equal(radioCanadaArticle.dateIso, "2026-08-09");
assert.equal(radioCanadaArticle.choiceRequired, false);
assert.equal(radioCanadaArticle.doNotShiftForBrownBullhead, true);
assert.doesNotMatch(radioCanadaArticle.copy, /https?:\/\/ici\.radio-canada\.ca/i,
  "Le texte destiné à Meta doit rester natif et sans URL de média.");
assert.match(radioCanadaArticle.source, /2273213\/moule-zebree-espece-envahissante-lac-massawippi/,
  "La source interne doit conserver le lien exact de l’article.");
assert.match(radioCanadaArticle.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/);
assert.ok(radioCanadaArticle.copy.length <= 2200, "Le relais bilingue de l’article doit respecter la limite Meta.");
assert.ok(!/2442552\/entrevue/.test(radioCanadaArticle.copy), "Le post de l’article écrit doit rester distinct du relais OHdio.");
const radioCanadaInterview = posts.find((post) => post.id === "actualite-20260808-denis-radio-canada-moules-zebrees");
assert.ok(radioCanadaInterview, "Le relais de l’entrevue de Denis à Radio-Canada doit être conservé dans le plan.");
assert.equal(radioCanadaInterview.dateIso, "2026-08-08");
assert.doesNotMatch(radioCanadaInterview.copy, /https?:\/\/ici\.radio-canada\.ca/i,
  "Le texte destiné à Meta doit rester natif et sans URL de média.");
assert.match(radioCanadaInterview.source, /2442552\/entrevue/,
  "La source interne doit conserver le lien exact de l’entrevue.");
assert.match(radioCanadaInterview.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/);
assert.match(radioCanadaInterview.fallback, /ne pas inventer de citation/i,
  "La garde contre toute citation inventée doit rester explicite.");
const restoredCompletedPost = posts.find((post) => post.id === "alt-20260731");
assert.equal(restoredCompletedPost.dateIso, "2026-08-04", "Le contenu déjà programmé doit demeurer au 4 août.");
assert.equal(restoredCompletedPost.displacedBy, null);
assert.match(restoredCompletedPost.rescheduledReason, /publication déjà programmée/i);
assert.match(radioCanadaArticle.rescheduledReason, /restaurer sans altération/i);
const nonMotorizedWash = posts.find((post) => post.id === "lavage-20260903-sans-moteur");
assert.ok(nonMotorizedWash, "La recommandation du 23 juillet sur les embarcations non motorisées doit devenir une publication planifiée.");
assert.equal(nonMotorizedWash.dateIso, "2026-08-26",
  "Le rappel de lavage doit être avancé pendant que la fréquentation estivale du lac demeure forte.");
assert.equal(nonMotorizedWash.choiceRequired, false);
assert.match(nonMotorizedWash.rescheduledReason, /direction du 24 août 2026.*fréquentation estivale/i);
assert.match(nonMotorizedWash.copy, /canot[\s\S]*planche à pagaie[\s\S]*canoe[\s\S]*paddleboard/i);
assert.match(nonMotorizedWash.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/);
assert.ok(nonMotorizedWash.copy.length <= 2200, "La publication bilingue doit respecter la limite Meta convenue.");
const poetryCall = posts.find((post) => post.id === "poesie-20260727-appel-aux-voix");
const deferredJuly27Monitoring = posts.find((post) => post.id === "s3d1");
assert.ok(poetryCall, "L’appel aux voix Au bord du bleu doit exister dans le calendrier.");
assert.equal(poetryCall.dateIso, "2026-07-27");
assert.equal(poetryCall.choiceRequired, false);
assert.equal(poetryCall.replacesDailySlot, true);
assert.match(poetryCall.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/);
assert.match(poetryCall.copy, /https:\/\/forms\.office\.com\/r\/4A2xsMh7st/);
assert.match(poetryCall.copy, /5 à 15 minutes/);
assert.match(poetryCall.copy, /5 to 15 minutes/);
assert.ok(poetryCall.copy.length <= 2200, "L’appel bilingue doit respecter la limite Meta convenue.");
assert.deepEqual(activePosts.filter((post) => post.dateIso === "2026-07-27").map((post) => post.id), [poetryCall.id], "Le 27 juillet actif doit être réservé à l’appel aux voix.");
assert.equal(deferredJuly27Monitoring.dateIso, "2026-07-29", "La publication scientifique doit occuper le mercredi 29 juillet.");
assert.equal(deferredJuly27Monitoring.originalDateIso, "2026-07-27", "La date d’origine doit rester consignée.");
assert.equal(deferredJuly27Monitoring.rescheduledFrom, "2026-08-15", "Le créneau précédent doit rester traçable.");
assert.deepEqual(deferredJuly27Monitoring.rescheduleHistory?.map(({ from, to }) => ({ from, to })), [
  { from: "2026-07-27", to: "2026-08-15" },
  { from: "2026-08-15", to: "2026-07-29" }
]);
assert.equal(deferredJuly27Monitoring.displacedBy, null);
const donationAppeal = posts.find((post) => post.id === "don-20260729-appel-soutien");
const donationThanks = posts.find((post) => post.id === "don-20260807-merci-bilan");
assert.equal(donationAppeal.parallelOperationalItem, false, "L’appel aux dons doit occuper seul le créneau quotidien prioritaire.");
assert.equal(donationAppeal.calendarPriority, "donation-cadence");
assert.equal(donationAppeal.replacesDailySlot, true);
assert.equal(donationAppeal.dateIso, "2026-07-22", "L’appel Zeffy doit occuper le mercredi 22 juillet.");
assert.equal(donationAppeal.rescheduledFrom, "2026-07-29", "Le déplacement doit rester explicite sans renommer l’événement Firestore.");
assert.deepEqual(activePosts.filter((post) => post.dateIso === "2026-07-22").map((post) => post.id), [donationAppeal.id], "Le 22 juillet actif doit être réservé à l’appel Zeffy.");
assert.match(donationAppeal.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/);
assert.match(donationAppeal.copy, /Adhésion — Doublez votre impact[\s\S]*100 \$[\s\S]*200 \$/i);
assert.match(donationAppeal.copy, /new membership/i);
assert.match(donationAppeal.copy, /\$100[\s\S]*\$200/i);
assert.match(donationAppeal.copy, /zeffy\.com\/fr-CA\/ticketing\/42ba0194-3043-44a6-a194-b6e7e6b43007/);
assert.match(donationAppeal.copy, /zeffy\.com\/en-CA\/ticketing\/42ba0194-3043-44a6-a194-b6e7e6b43007/);
assert.ok(donationAppeal.copy.length <= 2200, "La légende bilingue complète doit respecter la limite Meta convenue.");
assert.match(donationAppeal.source, /limitent le doublement à la contribution des nouveaux membres/i);
assert.match(donationAppeal.fallback, /ne jamais laisser entendre que tous les dons libres sont doublés/i);
assert.doesNotMatch(donationAppeal.copy, /(?:chaque|tous? les|every|all) (?:don|dons|donation|donations|contribution|contributions)[^\n]{0,80}(?:doubl|double)/i,
  "La publication ne doit jamais prétendre que tous les dons libres sont doublés.");
assert.equal(donationThanks.publicationBlocked, true, "Le remerciement doit rester bloqué tant que le montant réel n’est pas confirmé.");
assert.equal(donationThanks.requiresConfirmedDonationAmount, true);
assert.deepEqual(donationThanks.requiredPlaceholders, ["[DATE DE L’APPEL]", "[MONTANT NET CONFIRMÉ]", "[APPEAL DATE]", "[CONFIRMED NET AMOUNT]"]);
assert.match(donationThanks.source, /Paiements filtré par date de paiement/i);
assert.deepEqual(posts.filter((post) => post.dateIso === "2026-10-02").map((post) => post.id), [donationThanks.id], "Le bilan non publié du 7 août doit être conservé au 2 octobre.");
const displacedRainPost = posts.find((post) => post.id === "s3d4");
assert.equal(displacedRainPost.dateIso, "2026-08-12", "Le post pluie doit occuper un créneau unique dans le calendrier continu.");
assert.equal(displacedRainPost.rescheduledFrom, "2026-08-15");
assert.equal(displacedRainPost.displacedBy, deferredJuly27Monitoring.id);
assert.deepEqual(activePosts.filter((post) => post.dateIso === "2026-07-29").map((post) => post.id), [deferredJuly27Monitoring.id]);
assert.deepEqual(activePosts.filter((post) => post.dateIso === "2026-08-12").map((post) => post.id), [displacedRainPost.id]);
const displacedBoatCleaningPost = posts.find((post) => post.id === "alt-20260722");
assert.equal(displacedBoatCleaningPost.dateIso, "2026-08-01", "Le post remplacé le 22 juillet doit être conservé et rapproché dans le premier trou disponible.");
assert.equal(displacedBoatCleaningPost.archivedEditorial, undefined, "Le post déplacé ne doit pas devenir une archive.");
assert.equal(displacedBoatCleaningPost.displacedBy, donationAppeal.id);
const displacedWatershedPost = posts.find((post) => post.id === "s4d5");
const displacedHeritagePost = posts.find((post) => post.id === "alt-20260807");
assert.equal(displacedWatershedPost.dateIso, "2026-08-20");
assert.equal(displacedWatershedPost.displacedBy, null);
assert.match(displacedWatershedPost.rescheduledReason, /nouvelle cadence variée de cinq publications/i);
assert.equal(displacedHeritagePost.dateIso, "2026-08-13");
assert.equal(displacedWatershedPost.optionGroup, null);
assert.equal(displacedHeritagePost.optionGroup, null);
assert.equal(displacedWatershedPost.choiceRequired, false);
assert.equal(displacedHeritagePost.choiceRequired, false);
const rejectedNorthHatley = posts.find((post) => post.id === "alt-20260810");
assert.equal(rejectedNorthHatley.date, "Archive éditoriale");
assert.equal(rejectedNorthHatley.archivedEditorial, true);
assert.equal(rejectedNorthHatley.archived, true);
assert.equal(activePosts.some((post) => post.id === rejectedNorthHatley.id), false, "Un angle écarté doit rester archivé sans revenir dans le calendrier actif.");
const rejectedMassawippiFalls = posts.find((post) => post.id === "alt-20260804");
assert.equal(rejectedMassawippiFalls.date, "Archive éditoriale");
assert.equal(rejectedMassawippiFalls.archivedEditorial, true);
assert.equal(rejectedMassawippiFalls.archived, true);
assert.equal(activePosts.some((post) => post.id === rejectedMassawippiFalls.id), false, "Tous les angles écartés doivent quitter le calendrier actif sans être supprimés.");
const bullheadPost = posts.find((post) => post.id === "barbotte-20260730-signalement");
assert.ok(bullheadPost, "Le signalement de la barbotte demandé par la direction doit devenir une publication complète.");
assert.equal(bullheadPost.dateIso, "2026-08-06", "La barbote non validée doit être reportée d’au moins une semaine sans quitter le calendrier.");
assert.match(bullheadPost.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/);
assert.match(bullheadPost.copy, /date[\s\S]*secteur[\s\S]*photo[\s\S]*info@bleumassawippi\.com/i);
assert.match(bullheadPost.copy, /Avez-vous déjà vu ou capturé une barbotte brune dans le lac Massawippi avec ce type de lésion sur le corps\?/i,
  "La question française doit reprendre la formulation demandée par la direction.");
assert.match(bullheadPost.copy, /lésions[\s\S]*(?:type of lesion|similar lesions)/i,
  "Le texte doit reprendre le vocabulaire de signalement explicitement demandé par la direction dans les deux langues.");
assert.doesNotMatch(bullheadPost.copy, /mieux documenter sa présence/i,
  "La phrase retirée explicitement par la direction ne doit pas réapparaître.");
assert.match(bullheadPost.copy, /Memphrémagog[\s\S]*Magog[\s\S]*Memphremagog[\s\S]*Magog/i,
  "Le contexte régional vérifié doit être présent dans les deux langues.");
assert.doesNotMatch(bullheadPost.copy, /cancer|maladie|tumeur|disease|tumou?r/i,
  "L’appel doit demander des signalements sans poser de diagnostic ni inquiéter inutilement.");
assert.ok(bullheadPost.copy.length <= 2200);
const archivedBullheadMediaIds = [
  "editorial-barbotte-20260730-signalement-v2",
  "editorial-barbotte-20260806-marques-visibles-v1"
];
for (const mediaId of archivedBullheadMediaIds) {
  const archivedMedia = editorialMedia.find((media) => media.id === mediaId);
  assert.equal(archivedMedia?.eventId, bullheadPost.id);
  assert.equal(archivedMedia?.stage, "archived");
  assert.equal(archivedMedia?.archived, true);
}
const activeBullheadMedia = editorialMedia.filter((media) => media.eventId === bullheadPost.id && media.stage !== "archived" && media.archived !== true);
assert.deepEqual(activeBullheadMedia.map((media) => media.id), ["editorial-barbotte-20260806-tumeurs-usgs-v3"],
  "Le poster documentaire demandé doit être le seul média actif du post du 6 août.");
assert.ok(fs.existsSync(path.join(here, "media-previews", "2026-08-06", "barbotte-tumeurs-photo-usgs-poster-v3-preview.webp")),
  "L’aperçu léger du poster documentaire de la barbote doit être livré avec le cockpit.");
const approvedCommunityChoice = posts.find((post) => post.id === "s4d7");
assert.equal(approvedCommunityChoice.dateIso, "2026-07-30", "Le post entièrement approuvé par les deux rôles doit remplacer la barbote aujourd’hui.");
assert.deepEqual(activePosts.filter((post) => post.dateIso === "2026-07-30").map((post) => post.id), [approvedCommunityChoice.id]);
assert.deepEqual(activePosts.filter((post) => post.dateIso === "2026-08-06").map((post) => post.id), [bullheadPost.id]);
const poetryReminder = posts.find((post) => post.id === "poesie-20260803-rappel-candidatures");
assert.ok(poetryReminder, "Le rappel Au bord du bleu doit rester planifié.");
assert.equal(poetryReminder.dateIso, "2026-08-03");
assert.equal(poetryReminder.doNotShiftForBrownBullhead, true);
assert.match(poetryReminder.copy, /https:\/\/forms\.office\.com\/r\/4A2xsMh7st/);
assert.ok(poetryReminder.copy.length <= 2200);
const wetlandPost = posts.find((post) => post.id === "s4d4");
assert.equal(wetlandPost.title, "Ici, l’eau prend son temps");
assert.match(wetlandPost.copy, /milieux humides ralentissent sa circulation/i);
assert.doesNotMatch(wetlandPost.copy + wetlandPost.visual, /trois alliés|station de lavage|jeu visuel|photographie réelle|dépôt des sédiments|habitat/i,
  "La nouvelle approche doit rester centrée sur un seul milieu humide et un seul mécanisme.");
const wetlandMedia = editorialMedia.filter((media) => media.eventId === "s4d4" && media.stage !== "archived" && media.archived !== true);
assert.deepEqual(wetlandMedia.map((media) => media.id), ["editorial-s4d4-wetland-school-chart-v6"],
  "Une seule proposition illustrée doit rester active pour le milieu humide.");
assert.match(wetlandMedia[0].rightsStatus, /illustration originale/i);
const waterLilyMedia = editorialMedia.find((media) => media.id === "editorial-alt-20260805-water-lily-real-v3");
assert.match(waterLilyMedia.note, /n’est pas présentée comme ayant été prise au lac Massawippi/i);
const monitoringMedia = editorialMedia.filter((media) => media.eventId === "s1d2" && media.stage !== "archived");
assert.equal(monitoringMedia.length, 2);
assert.ok(monitoringMedia.every((media) => media.publicationBlocked === true && /consentement à confirmer/i.test(media.rightsStatus)),
  "Les photographies de terrain restent visibles pour préparation, mais bloquées jusqu’à confirmation des droits.");
const preferredMonitoringMedia = monitoringMedia.find((media) => media.id === "editorial-s1d2-lake-sampling-real-v3");
assert.match(preferredMonitoringMedia.label, /Préférence de la direction/i);
assert.match(preferredMonitoringMedia.note, /choix final demeure bloqué/i,
  "Une préférence ne doit pas contourner la confirmation des droits et du consentement.");
const samplingPost = posts.find((post) => post.id === "s3d5");
assert.match(samplingPost.title, /prélèvement/i, "Le retour sur les résultats doit devenir une explication concrète du prélèvement.");
assert.match(samplingPost.copy, /lac, tributaire ou plage/i);
assert.match(samplingPost.copy, /seulement après (leur )?validation/i);
const lakeTroutPost = posts.find((post) => post.id === "alt-20260729");
assert.match(lakeTroutPost.title, /touladi/i);
assert.match(lakeTroutPost.copy, /n’est jamais un verdict à elle seule/i,
  "Le touladi doit être présenté comme un indicateur à lire avec d’autres données, jamais comme un diagnostic isolé.");
assert.match(lakeTroutPost.copy, /température, l’oxygène, l’habitat et d’autres observations/i);
assert.match(lakeTroutPost.copy, /portrait du touladi réalisé en 2023/i);
assert.equal((lakeTroutPost.copy.match(/Salvelinus namaycush/g) || []).length, 2,
  "Le nom scientifique confirmé du touladi doit rester visible dans les deux langues.");
const lakeTroutMedia = editorialMedia.find((media) => media.id === "editorial-alt-20260729-lake-trout-real-v1");
assert.ok(lakeTroutMedia, "La proposition documentaire réelle du touladi doit être inscrite au manifeste.");
assert.match(lakeTroutMedia.rightsStatus, /domaine public/i);
assert.match(lakeTroutMedia.note, /n’est pas présentée comme ayant été prise au lac Massawippi/i);
const visualPausePost = posts.find((post) => post.id === "s3d6");
assert.match(visualPausePost.format, /Photo plein cadre/i);
assert.match(visualPausePost.copy, /quel souvenir gardez-vous de votre Massawippi\?/i, "La question courte validée doit demeurer dans la respiration photo.");
assert.doesNotMatch(visualPausePost.copy, /commentaire/i, "La respiration photo ne doit pas demander explicitement un commentaire.");
const fiveHabitsPost = posts.find((post) => post.id === "s3d7");
assert.match(fiveHabitsPost.title, /Cinq réflexes/i);
assert.match(fiveHabitsPost.copy, /5 —/);
assert.match(fiveHabitsPost.copy, /4 — Ne pas utiliser d’engrais chimiques ou de pesticides près du lac et des cours d’eau\./i,
  "Le point 4 français du 18 août doit porter l’interdiction formulée par la direction.");
assert.match(fiveHabitsPost.copy, /4 — Do not use chemical fertilizers or pesticides near the lake and waterways\./i,
  "Le point 4 anglais du 18 août doit rester symétrique à la formulation française.");
assert.doesNotMatch(fiveHabitsPost.copy, /Éviter d’utiliser des engrais chimiques|Avoid chemical fertilizers/i,
  "L’ancienne formulation du point 4 ne doit plus être diffusée.");
const boardPortrait = posts.find((post) => post.id === "s1d3");
assert.match(boardPortrait.title, /Pourquoi nous nous impliquons/i);
assert.ok(boardPortrait.tasksAnnie.length >= 4);
const denisTemporaryMedia = editorialMedia.find((media) => media.id === "editorial-s1d3-denis-temporaire-photo-citation-v1");
assert.ok(denisTemporaryMedia, "La proposition temporaire de Denis doit être reliée au portrait du conseil.");
assert.match(denisTemporaryMedia.fileName, /denis-petitclerc-temporaire/i,
  "Le caractère temporaire doit être visible dans le nom du fichier, jamais ajouté à l’image.");
assert.match(denisTemporaryMedia.label, /temporaire/i,
  "Le caractère temporaire doit être visible dans le cockpit.");
assert.equal(denisTemporaryMedia.publicationBlocked, true,
  "La photographie temporaire ne doit pas pouvoir être choisie avant consentement et confirmation des droits.");
assert.match(denisTemporaryMedia.note, /citation publique authentique[\s\S]*consentement explicite/i);
assert.match(denisTemporaryMedia.previewUrl, /\/media-previews\/2026-09-08\/denis-petitclerc-temporaire-photo-argentique-citation-v1-preview\.webp$/);
const lexiconPost = posts.find((post) => post.id === "lexique-20260830-tributaire");
assert.match(lexiconPost.copy, /cours d’eau qui en rejoint un autre/i);
assert.doesNotMatch(lexiconPost.copy, /Quel autre mot lié au lac aimeriez-vous que nous expliquions simplement/i,
  "La question publique retirée par la direction ne doit pas réapparaître en français.");
assert.doesNotMatch(lexiconPost.copy, /Which other lake-related word would you like us to explain in plain language/i,
  "La version anglaise doit rester symétrique après le retrait demandé par la direction.");
const firstFourWeeks = Object.groupBy(posts.filter((post) => post.w <= 4), (post) => post.date);
assert.equal(Object.keys(firstFourWeeks).length, 27,
  "Le bilan financier non publié du 7 août est reporté; les 27 autres dates historiques restent inchangées.");
assert.equal(Object.values(firstFourWeeks).filter((items) => items.length >= 2).length, 0,
  "Chaque date des quatre premières semaines doit désormais contenir une seule publication active.");
assert.ok(firstFourWeeks["Mercredi 22 juillet"].some((post) => post.id === donationAppeal.id));
assert.equal(firstFourWeeks["Vendredi 7 août"], undefined);
assert.equal(donationThanks.dateIso, "2026-10-02");
const deferredBoatWash = posts.find((post) => post.id === "s4d1");
assert.equal(deferredBoatWash.date, "Mardi 11 août");
assert.equal(deferredBoatWash.w, 5);
assert.match(deferredBoatWash.title, /rituel complet/i);
assert.match(deferredBoatWash.copy, /retirer les débris visibles, vider l’eau retenue, nettoyer/i);
assert.match(deferredBoatWash.copy, /kayaks, les planches à pagaie/i,
  "Le rituel doit aussi nommer clairement les petites embarcations demandées par la direction.");
assert.match(deferredBoatWash.visual, /photographie interne réelle de la station de lavage actuelle/i);
assert.doesNotMatch(deferredBoatWash.source, /ccq\.org/i);
const northHatleyHistorical = historicalMedia.find((media) => media.id === "history-alt-20260801-aerial");
const northHatleyCurrent = historicalMedia.find((media) => media.id === "history-alt-20260801-aerial-current-2024");
assert.match(northHatleyHistorical.label, /Carte 1\/2 du carrousel/i);
assert.match(northHatleyCurrent.label, /Carte 2\/2 du carrousel/i);
assert.equal(northHatleyCurrent.publicationBlocked, false,
  "La carte actuelle doit pouvoir faire partie du carrousel du 5 août, les droits étant traités en amont pour ce post.");
const northHatleyPost = posts.find((post) => post.id === "alt-20260801");
assert.equal(northHatleyPost.mediaSelectionMode, "multiple");
assert.equal(northHatleyPost.mediaSelectionRequired, 2);
assert.match(northHatleyPost.task, /Les droits sont traités en amont/i);
assert.match(posts.find((post) => post.id === "alt-20260801").task, /Ayer’s Cliff restent réservées à une publication distincte/i);
const soloAugustThird = posts.find((post) => post.id === "s4d1b");
assert.equal(soloAugustThird.choiceRequired, false, "La seule carte du 3 août ne doit pas afficher un faux choix.");
assert.equal(soloAugustThird.optionGroup, null);
const sundayHeritage = posts.find((post) => post.id === "alt-20260719");
assert.equal(sundayHeritage.date, "Dimanche 19 juillet");
assert.equal(sundayHeritage.w, 1);
assert.match(sundayHeritage.title, /Massawippi vu en 1859/i);
const deferredMonitoring = posts.find((post) => post.id === "s1d2");
assert.equal(deferredMonitoring.date, "Dimanche 27 septembre");
assert.equal(deferredMonitoring.w, 11);
assert.equal(deferredMonitoring.displacedBy, "actualite-20260808-denis-radio-canada-moules-zebrees");
assert.match(deferredMonitoring.rescheduledReason, /entrevue de Denis Petitclerc à Radio-Canada Estrie/i);
assert.match(deferredMonitoring.title, /lac et ses tributaires/i);
assert.match(deferredMonitoring.copy, /chaque observation, prélèvement et mesure ajoute une donnée/i);
assert.doesNotMatch(deferredMonitoring.copy, /un repère/i);
const lakeLovePost = posts.find((post) => post.id === "s2d7");
assert.match(lakeLovePost.title, /amour du lac/i);
assert.match(lakeLovePost.copy, /l’amour du lac/i);
assert.doesNotMatch(lakeLovePost.copy, /\?/i, "La respiration patrimoniale ne doit pas demander une interaction.");
assert.match(lakeLovePost.visual, /uniquement la carte postale historique complète 1900_ancienne-bibliotheque/i);
const saturdayCommunity = posts.find((post) => post.id === "s1d4");
const deferredBlueMinute = posts.find((post) => post.id === "s1d6");
const deferredMemories = posts.find((post) => post.id === "s1d7");
const deferredShoreLife = posts.find((post) => post.id === "alt-20260718");
assert.equal(saturdayCommunity.date, "Samedi 18 juillet", "Le choix communautaire de la direction doit rester seul le samedi.");
assert.equal(deferredBlueMinute.date, "Mardi 21 juillet", "L’Instant bleu doit rester espacé du contenu communautaire.");
assert.equal(deferredBlueMinute.title, "Juste un instant");
assert.match(deferredBlueMinute.copy, /Prendre un instant pour regarder ce que nous avons la chance de protéger/);
assert.doesNotMatch(deferredBlueMinute.copy, /Juste un instant pour regarder/);
assert.match(deferredBlueMinute.copy, /#InstantBleu/);
assert.doesNotMatch(`${deferredBlueMinute.title}\n${deferredBlueMinute.visual}\n${deferredBlueMinute.copy}`, /Juste une minute|Une minute bleue|#MinuteBleue/i);
assert.doesNotMatch(saturdayCommunity.copy, /Nous avons envie de découvrir ce qui fait vivre votre lien/i);
assert.equal(deferredMemories.date, "Dimanche 6 septembre", "La capsule souvenirs doit rester conservée à une autre date.");
assert.equal(deferredShoreLife.date, "Dimanche 13 septembre", "La biodiversité sous les feuilles doit rester conservée au créneau libéré par le rappel de lavage.");
const seasonalEssentials = posts.find((post) => post.id === "alt-20260714");
const displacedLoon = posts.find((post) => post.id === "alt-20260721");
assert.equal(seasonalEssentials.dateIso, "2026-09-28",
  "La capsule pratique du samedi doit être conservée au prochain créneau libre sans collision.");
assert.match(seasonalEssentials.rescheduledReason, /réserver le samedi 29 août au rappel Au bord du bleu/i);
assert.ok(seasonalEssentials.rescheduleHistory.some((entry) => entry.from === "2026-09-14" && entry.to === "2026-08-29"),
  "Le déplacement antérieur demandé par la direction doit rester dans l’historique.");
assert.equal(displacedLoon.dateIso, "2026-09-14",
  "La capsule sur le huard doit rester conservée au créneau libéré par l’avancement saisonnier.");
const frogSeries = posts.find((post) => post.id === "alt-20260802");
assert.equal(frogSeries.title, "Les voix du bassin");
assert.match(frogSeries.copy, /Cette première publication présente la série; elle ne constitue pas un inventaire du bassin/i);
assert.match(frogSeries.copy, /une espèce à la fois/i);
assert.match(frogSeries.copy, /Quelle voix aimeriez-vous apprendre à reconnaître en premier?/i);
assert.doesNotMatch(frogSeries.copy, /neuf espèces|nine species|crapaud d’Amérique|ouaouaron/i,
  "L’ouverture de la série ne doit plus ressembler à un inventaire technique difficile à suivre.");
assert.match(frogSeries.visual, /Proposition 3.*direction apprécie/i);
const decidedFirstTwoWeeks = Object.groupBy(posts.filter((post) => post.w <= 2), (post) => post.date);
assert.equal(Object.keys(decidedFirstTwoWeeks).length, 14, "Les deux semaines arbitrées doivent conserver une publication par jour.");
assert.ok(Object.values(decidedFirstTwoWeeks).every((items) => items.length === 1), "Chaque journée déjà arbitrée doit afficher une seule publication retenue.");
assert.equal(posts.filter((post) => post.t === "Nature").length, 10);
assert.equal(FUTURE_EDITORIAL_IDS.length, 56, "Les 56 publications futures doivent recevoir la voix éditoriale révisée.");
assert.equal(new Set(FUTURE_EDITORIAL_IDS).size, 56, "Chaque publication future doit avoir un seul remplacement éditorial.");
assert.ok(!FUTURE_EDITORIAL_IDS.includes("s1d1"), "La publication du 13 juillet doit rester intacte.");
assert.equal(first.editorialToneVersion, undefined, "La publication du jour ne doit pas être réécrite par la couche future.");
const futurePosts = posts.filter((post) => FUTURE_EDITORIAL_IDS.includes(post.id));
assert.equal(futurePosts.length, 56, "Chaque remplacement éditorial doit correspondre à une publication réelle.");
for (const post of futurePosts) {
  assert.equal(post.editorialToneVersion, TONE_VERSION, `La publication ${post.id} doit utiliser la voix chaleureuse.`);
  assert.equal(post.bilingualPolicyVersion, BILINGUAL_POLICY_VERSION, `La publication ${post.id} doit suivre la règle français original / anglais adapté.`);
  assert.ok(post.title && post.cta && post.visual, `La publication ${post.id} doit avoir un titre, un CTA et un brief visuel finalisés.`);
  assert.ok(post.copy.length <= 2200, `La publication ${post.id} doit rester sous 2 200 caractères.`);
  assert.doesNotMatch(
    `${post.title}\n${post.cta}\n${post.visual}\n${post.copy}`,
    /ne pas toucher|juste regarder|observer sans paniquer|pas de consigne|bon réflexe|bon voisin|sans capturer ni déplacer/i,
    `La publication ${post.id} ne doit pas adopter un ton professoral ou réprobateur.`
  );
}
for (const post of posts) {
  assert.match(post.copy || "", /FR\s+—/i, `La publication ${post.id} doit contenir son texte français.`);
  assert.match(post.copy || "", /EN\s+—/i, `La publication ${post.id} doit contenir son texte anglais.`);
  assert.ok(post.copy.indexOf("FR —") < post.copy.indexOf("EN —"), `La publication ${post.id} doit présenter le français avant l’anglais.`);
}
assert.match(source, /Le français d’abord/);
for (const historicalId of ["alt-20260719", "alt-20260726", "alt-20260801", "alt-20260804", "alt-20260807", "alt-20260810"]) {
  const historicalPost = posts.find((post) => post.id === historicalId);
  assert.ok(historicalPost, `La capsule historique ${historicalId} doit rester au calendrier.`);
  assert.match(historicalPost.source, /Domaine public/i);
  assert.equal(historicalPost.t, "Patrimoine");
}
const preparedPlanScript = preparePlanScript(source.match(/<script>\s*(var posts=[\s\S]*?)<\/script>/i)[1], posts);
assert.match(preparedPlanScript, /Array\.from\(new Set\(list\.map/, "Le rendu privé doit accepter les semaines ajoutées par le Studio sans plafond fixe.");
assert.match(preparedPlanScript, /Calendrier évolutif/, "Une nouvelle semaine doit recevoir un libellé de repli lisible.");
assert.match(preparedPlanScript, /Object\.keys\(days\)\.sort/, "Le rendu privé doit trier les journées avant de construire les cartes.");
assert.match(source, /Object\.keys\(days\)\.sort/, "La source locale doit suivre le même ordre chronologique.");
assert.doesNotMatch(source, /readybox|id="done"/, "L’ancien état local « prêt » ne doit plus contredire le workflow partagé.");
assert.doesNotMatch(source, /<main class="wrap">/, "Le contenu injecté ne doit pas créer deux éléments main imbriqués.");
assert.match(source, /planMonthIndex=\{janvier:0,[\s\S]*septembre:8/,
  "Le calendrier doit archiver correctement les publications de tous les mois, y compris septembre.");
assert.match(source, /new Date\(2026,month,Number\(m\[1\]\),23,59,59,999\)/,
  "Une publication doit rester visible jusqu’à la fin de sa journée locale.");
assert.ok(ui.includes("function isPlanItemPast"), "L’aperçu éditorial doit reconnaître les jours passés.");
assert.match(ui, /schedule\?\.status !== "deleted"[\s\S]{0,100}!isPlanItemPast\(item\)/,
  "L’aperçu éditorial doit masquer les jours passés par défaut.");
assert.match(ui, /item\.archivedEditorial !== true[\s\S]{0,120}!isPlanItemPast\(item\)/, "L’aperçu actif doit exclure les archives éditoriales.");
assert.match(ui, /focusMonthlySnapshotEvent\(itemId, allowRetry = true\)/);
assert.match(ui, /focusMonthlySnapshotEvent\(itemId, false\)/, "La navigation mensuelle doit borner sa relance.");
assert.match(ui, /setupCollapsibleNavigation/);
assert.match(sectionNavigation, /while \(node[\s\S]{0,180}node\.matches\?\.\("details"\)/, "La navigation doit ouvrir tous les volets ancêtres.");
assert.match(ui, /\[data-cockpit-private-root\] section\[id\]/, "Les boîtes d’avis doivent survivre au retrait du main imbriqué.");
assert.match(ui, /grid-template-columns:46px minmax\(0,1fr\)/, "Le bouton Enregistrer du mini-chat doit rester lisible sur mobile.");
assert.match(viewMode, /\(\?:er\)\?\\s\+\(janvier/);
assert.match(viewMode, /plain\.match\(\/\^\(\\d\{4\}\)\-\(\\d\{2\}\)\-\(\\d\{2\}\)\$\//, "La vue essentielle doit reconnaître les dates ISO canoniques.");
assert.match(viewMode, /date\.getFullYear\(\) === year[\s\S]{0,120}date\.getDate\(\) === day/, "Une date ISO invalide ne doit pas être normalisée silencieusement.");
assert.match(viewMode, /item\.dateIso \|\| item\.date/, "La vue essentielle doit utiliser la date ISO canonique.");
assert.match(viewMode, /distance > 0 && distance <= 7/, "Le panneau des sept prochains jours ne doit pas répéter Aujourd’hui.");
for (const token of ["calendarTime", "calendarDurationMinutes", "calendarLocation", "calendarCost", "postCalendarMetadata"]) {
  assert.ok(calendarExport.includes(token), `Le fichier calendrier doit utiliser ${token}.`);
}
assert.match(source, /Coordination renforcée avant publication/);
assert.match(source, /class="responsibility-empty"/,
  "Une colonne sans action doit rester visible au lieu de disparaître.");
assert.doesNotMatch(source, /if\(!Array\.isArray\(tasks\)\|\|!tasks\.length\)return ""/,
  "Le rendu ne doit jamais supprimer une colonne de responsabilités vide.");
assert.match(source, /ownerBlock\("Valentin — Directeur des communications"[\s\S]{0,700}ownerBlock\("Annie — Direction générale"/,
  "Chaque publication doit afficher les deux colonnes dans l’ordre communications puis direction générale.");
assert.match(source, /Aucune action requise de la direction générale à cette étape\./,
  "Une absence volontaire de tâche DG doit être expliquée explicitement.");
assert.match(source, /data-work-role="admin"/);
assert.match(source, /body:not\(\.cockpit-admin\)[\s\S]{0,180}work-estimate/, "La direction ne doit pas voir les estimations des communications.");
assert.match(ui, /data-develop-next-cycle="internalProject"/);
assert.match(ui, /data-develop-next-cycle="opportunity"/);
assert.match(ui, /develop-internal-/);
assert.match(ui, /develop-opportunity-/);
assert.match(source, /Interaction utile, jamais répétitive/);
assert.match(source, /Meta — engagement authentique/);
assert.match(source, /<option value="8">Semaine 8<\/option>/);
assert.equal(historicalMedia.length, 44);
assert.equal(new Set(historicalMedia.map((item) => item.id)).size, historicalMedia.length);
assert.equal(new Set(historicalMedia.map((item) => item.fileName)).size, historicalMedia.length);
assert.equal(new Set(historicalMedia.map((item) => item.eventId)).size, 22);
assert.equal(historicalMedia.filter((item) => /confirmer/i.test(item.license || "")).length, 2);
for (const media of historicalMedia) {
  assert.ok(posts.some((post) => post.id === media.eventId), `Le média ${media.fileName} doit être relié à une publication existante.`);
}
assert.doesNotMatch(JSON.stringify(historicalMedia), /sharepoint\.com|:\/g\/IQ/i);
const fridayHistoricalMedia = historicalMedia.filter((item) => item.eventId === "s2d7");
assert.equal(fridayHistoricalMedia.length, 6, "Toutes les sources du vendredi doivent rester conservées dans la banque historique.");
const fridayFeaturedMedia = fridayHistoricalMedia.filter((item) => item.archived !== true);
assert.deepEqual(fridayFeaturedMedia.map((item) => item.id), ["history-1900-ancienne-bibliotheque-north-hatley"],
  "Seule la carte postale de 1900 doit rester proposée le vendredi 17 juillet.");
assert.equal(fridayFeaturedMedia[0].stage, "proposal");
for (const archivedMedia of fridayHistoricalMedia.filter((item) => item.archived === true)) {
  assert.equal(archivedMedia.stage, "reference", `${archivedMedia.id} doit rester une référence archivée.`);
  assert.equal(archivedMedia.publicationBlocked, true, `${archivedMedia.id} ne doit pas pouvoir être retenu par erreur.`);
}
assert.match(mediaSeedSources.find(({ file }) => file === "seed_historical_media_links.js").source, /enforcedArchiveFields/,
  "Le seed historique doit maintenir l’archivage éditorial explicite lors des synchronisations futures.");
assert.ok(natureMedia.length > 0, "Le registre des visuels nature ne doit pas être vide.");
assert.equal(new Set(natureMedia.map((item) => item.id)).size, natureMedia.length);
assert.equal(new Set(natureMedia.map((item) => item.eventId)).size, 11);
for (const media of natureMedia) {
  const relatedPost = posts.find((post) => post.id === media.eventId);
  assert.ok(relatedPost, `L’affiche ${media.fileName} doit être reliée à une publication existante.`);
  assert.ok(relatedPost.t === "Nature" || ["lexique-20260830-tributaire", "alt-20260723"].includes(media.eventId), `L’affiche ${media.fileName} doit servir une publication nature, une capsule de rive ou la capsule lexique documentée.`);
  assert.match(media.fileName, /\.(?:jpg|png)$/);
  assert.ok(media.altText.length >= 60, `L’affiche ${media.fileName} doit conserver un texte alternatif utile.`);
}
assert.doesNotMatch(JSON.stringify(natureMedia), /sharepoint\.com|:\/g\/IQ/i);
assert.ok(editorialMedia.length > 0, "Le registre éditorial ne doit pas être vide.");
assert.equal(new Set(editorialMedia.map((item) => item.id)).size, editorialMedia.length);
for (const media of editorialMedia) {
  assert.ok(posts.some((post) => post.id === media.eventId), `Le visuel ${media.fileName} doit être relié à une publication existante.`);
  assert.match(media.fileName, /\.(?:jpg|png|mp4)$/);
  assert.ok(media.altText.length >= 60, `Le visuel ${media.fileName} doit conserver un texte alternatif utile.`);
}
const s1d7WallMedia = editorialMedia.find((item) => item.id === "editorial-s1d7-mon-massawippi-quai-mur-v1");
assert.ok(s1d7WallMedia, "La nouvelle proposition Mon Massawippi demandée par la direction doit être conservée.");
assert.equal(s1d7WallMedia.eventId, "s1d7");
assert.equal(s1d7WallMedia.publicationBlocked, true,
  "La composition sur photographie interne demeure bloquée tant que le droit de diffusion n’est pas documenté.");
assert.ok(historicalMedia.some((item) => item.id === "history-2013-maison-du-lac-ayers-cliff"),
  "L’ancienne proposition s1d7 doit rester conservée dans l’historique.");
for (const assetName of [s1d7WallMedia.fileName, "s1d7-mon-massawippi-quai-mur-v1-preview.webp"]) {
  assert.ok(fs.existsSync(path.join(here, "media-previews", "2026-09-06", assetName)),
    `Le fichier ${assetName} doit être livré avec le cockpit.`);
}
const s4d3DirectionPreference = editorialMedia.find((item) => item.id === "editorial-s4d3-field-inventory-real-v2");
assert.match(s4d3DirectionPreference?.label || "", /Préférence de la direction/i);
assert.equal(s4d3DirectionPreference?.publicationBlocked, true,
  "Une préférence visuelle de la direction ne doit pas contourner la confirmation des droits.");
const s4d6ArchivedIllustration = editorialMedia.find((item) => item.id === "editorial-s4d6-behind-scenes-cover-v1");
assert.equal(s4d6ArchivedIllustration?.stage, "archived",
  "Le dessin du 10 septembre doit rester conservé comme référence sans demeurer une proposition active.");
assert.equal(s4d6ArchivedIllustration?.archived, true);
const s4d6DivingPhoto = editorialMedia.find((item) => item.id === "editorial-s4d6-divers-real-photo-v2");
assert.equal(s4d6DivingPhoto?.stage, "archived",
  "La scène de plongée écartée par la direction doit rester conservée sans être proposée.");
assert.equal(s4d6DivingPhoto?.archived, true);
const s4d6RealPhoto = editorialMedia.find((item) => item.id === "editorial-s4d6-field-measure-real-v3");
assert.ok(s4d6RealPhoto, "Le 10 septembre doit proposer une vraie photographie montrant des humains.");
assert.equal(s4d6RealPhoto.eventId, "s4d6");
assert.equal(s4d6RealPhoto.stage, "reference");
const s4d6UsableAlternative = editorialMedia.find(item => item.id === "editorial-s4d6-usgs-water-sampling-v4");
assert.equal(s4d6UsableAlternative.stage, "proposal");
assert.equal(s4d6UsableAlternative.publicationBlocked, false);
assert.match(s4d6UsableAlternative.rightsStatus, /Domaine public/);
assert.match(posts.find(post => post.id === "s4d6").copy, /ce n’est pas le lac Massawippi/);
assert.match(posts.find(post => post.id === "s4d6").copy, /this is not Lake Massawippi/);
assert.equal(s4d6RealPhoto.publicationBlocked, true,
  "La nouvelle photographie humaine ne doit pas contourner la confirmation du crédit et des consentements.");
assert.match(s4d6RealPhoto.altText, /Photographie réelle[\s\S]*membre de l’équipe[\s\S]*instrument de mesure/i);
assert.ok(fs.existsSync(path.join(here, "media-previews", "2026-09-10", s4d6RealPhoto.fileName)),
  "La photographie réelle du 10 septembre doit être livrée avec le cockpit.");
assert.ok(fs.existsSync(path.join(here, "media-previews", "2026-09-10", "s4d6-terrain-mesure-photo-reelle-v3-preview.webp")),
  "L’aperçu 4:5 de la nouvelle photographie du 10 septembre doit être livré.");
const frogSeriesDirectionPreference = natureMedia.find((item) => item.id === "nature-alt-20260802-basin-voices-manuscript-v3");
assert.match(frogSeriesDirectionPreference?.label || "", /Préférence de la direction/i,
  "L’intérêt de la direction pour la proposition 3 doit rester visible sans simuler un choix final.");
assert.equal(frogSeriesDirectionPreference?.stage, "proposal");
const archivedSharedLakeIllustration = editorialMedia.find((item) => item.id === "editorial-alt-20260806-shared-enjoyment-v2");
assert.equal(archivedSharedLakeIllustration?.stage, "archived",
  "Le visuel déjà utilisé pour une publication semblable doit rester conservé sans être reproposé.");
assert.equal(archivedSharedLakeIllustration?.archived, true);
const sharedLakeRealPhoto = editorialMedia.find((item) => item.id === "editorial-alt-20260806-shared-lake-real-v3");
assert.equal(sharedLakeRealPhoto?.rightsStatus, "CC0 1.0 — domaine public");
assert.equal(sharedLakeRealPhoto?.publicationBlocked, false);
assert.match(sharedLakeRealPhoto?.note || "", /Josh Trommel.*ne doit pas être présentée comme une vue du lac Massawippi/i);
assert.ok(fs.existsSync(path.join(here, "media-previews", "2026-09-17", sharedLakeRealPhoto.fileName)),
  "La photographie documentaire distincte du 17 septembre doit être livrée avec le cockpit.");
const archivedBehindScenesIllustration = editorialMedia.find((item) => item.id === "editorial-alt-20260808-behind-scenes-v1");
assert.equal(archivedBehindScenesIllustration?.stage, "archived",
  "L’ancienne planche des coulisses doit rester conservée après la demande d’un autre visuel.");
assert.equal(archivedBehindScenesIllustration?.archived, true);
const behindScenesPreparationPhoto = editorialMedia.find((item) => item.id === "editorial-alt-20260808-preparation-real-v2");
assert.equal(behindScenesPreparationPhoto?.stage, "archived",
  "La photographie jugée peu convaincante par la direction doit rester conservée sans être proposée.");
assert.equal(behindScenesPreparationPhoto?.archived, true);
const behindScenesRealPhoto = editorialMedia.find((item) => item.id === "editorial-alt-20260808-coulisses-berge-real-v3");
assert.equal(behindScenesRealPhoto?.publicationBlocked, true,
  "La photo interne des coulisses doit attendre la confirmation du crédit et des consentements.");
assert.ok(fs.existsSync(path.join(here, "media-previews", "2026-09-20", behindScenesRealPhoto.fileName)),
  "La nouvelle photographie des coulisses doit être livrée avec le cockpit.");
assert.ok(fs.existsSync(path.join(here, "media-previews", "2026-09-20", "alt-20260808-coulisses-berge-photo-reelle-v3-preview.webp")),
  "L’aperçu 4:5 de la nouvelle photographie des coulisses doit être livré.");
for (const mediaId of [
  "editorial-s1d4-mon-massawippi-fridge-v5",
  "editorial-alt-20260719-engraving-crop-upscale-v3",
  "editorial-s2d5-vitesse-rive-planche-simple-v4",
  "editorial-actualite-20260809-denis-citation-science-v2"
]) {
  const media = editorialMedia.find((item) => item.id === mediaId);
  assert.match(media?.previewUrl || "", /^https:\/\/vhaloo\.github\.io\/bleu-massawippi-cockpit\/media-previews\/.+\.webp$/);
  const previewPath = new URL(media.previewUrl).pathname.replace(/^\/bleu-massawippi-cockpit\//, "");
  assert.ok(fs.existsSync(path.join(here, previewPath)), `La vignette publique de ${mediaId} doit être incluse dans le site.`);
}
const denisScienceMedia = editorialMedia.find((item) => item.id === "editorial-actualite-20260809-denis-citation-science-v2");
assert.equal(denisScienceMedia?.eventId, "actualite-20260804-article-radio-canada-moules-zebrees");
assert.match(denisScienceMedia?.note || "", /Ce n’est pas parce que la solution à un problème n’a pas été trouvée que la solution n’existe pas\. La science évolue\./);
assert.notEqual(denisScienceMedia?.publicationBlocked, true, "La photographie fournie et sa composition ne doivent pas hériter du blocage de l’image de presse archivée.");
const archivedArticleMedia = editorialMedia.find((item) => item.id === "editorial-actualite-20260804-radio-canada-article-v1");
assert.equal(archivedArticleMedia?.stage, "archived");
assert.equal(archivedArticleMedia?.archived, true);
const archivedSecchiIds = [
  "editorial-s1d5-secchi-v1",
  "editorial-s1d5-secchi-answer-v1",
  "editorial-s1d5-secchi-manuscript-v2",
  "editorial-s1d5-secchi-answer-manuscript-v2"
];
for (const archivedId of archivedSecchiIds) {
  const archivedSecchi = editorialMedia.find((item) => item.id === archivedId);
  assert.ok(archivedSecchi, `${archivedId} doit rester conservé dans le registre.`);
  assert.equal(archivedSecchi.stage, "archived", `${archivedId} doit être retiré des propositions actives sans être supprimé.`);
}
const secchiSource = editorialMedia.find((item) => item.id === "editorial-s1d5-secchi-real-photo-v3");
assert.equal(secchiSource?.stage, "source", "La photographie réelle d’origine doit rester conservée comme source documentée.");
const realSecchiV4 = editorialMedia.find((item) => item.id === "editorial-s1d5-secchi-real-manuscript-v4");
assert.ok(realSecchiV4, "La proposition Secchi fondée sur une photographie réelle doit exister.");
assert.equal(realSecchiV4.eventId, "s1d5");
assert.equal(realSecchiV4.stage, "proposal");
assert.match(realSecchiV4.fileName, /secchi.*bilingue-v4\.png$/);
assert.match(realSecchiV4.altText, /photographie réelle[\s\S]*À votre avis[\s\S]*What do you think/i);
assert.match(realSecchiV4.rightsStatus, /photographie du domaine public/i);
assert.deepEqual(
  editorialMedia
    .filter((item) => item.eventId === "s1d5" && !["archived", "source"].includes(item.stage || "proposal"))
    .map((item) => item.id),
  [realSecchiV4.id],
  "La v4 doit être la seule proposition Secchi active; les anciennes cartes restent archivées et la photo brute reste une source."
);
const correctedDragonfly = natureMedia.find((item) => item.id === "nature-alt-20260715-libellule-manuscript-v5-scientific-bilingual");
assert.ok(correctedDragonfly, "La libellule scientifiquement validée et bilingue doit être proposée.");
assert.match(correctedDragonfly.altText, /exactement quatre ailes[\s\S]*six pattes/i);
assert.match(correctedDragonfly.note, /français et anglais/i);
assert.match(correctedDragonfly.note, /quatre ailes en répartition 2 \+ 2[\s\S]*six pattes en répartition 3 \+ 3/i);
assert.equal(correctedDragonfly.stage, "proposal");
assert.equal(correctedDragonfly.publicationBlocked, false);
assert.equal(correctedDragonfly.archived, false);
const fieldPlateDragonfly = natureMedia.find((item) => item.id === "nature-alt-20260715-libellule-field-plate-v6");
assert.ok(fieldPlateDragonfly, "La nouvelle planche naturaliste doit être proposée à la sélection.");
assert.match(fieldPlateDragonfly.note, /quatre ailes et six pattes/i);
assert.equal(fieldPlateDragonfly.stage, "proposal");
assert.equal(fieldPlateDragonfly.publicationBlocked, false);
for (const conceptId of ["nature-alt-20260715-libellule-water-cycle-v7-concept", "nature-alt-20260715-libellule-lake-flash-v8-concept"]) {
  const concept = natureMedia.find((item) => item.id === conceptId);
  assert.equal(concept.stage, "reference", `${conceptId} doit rester une référence visible.`);
  assert.equal(concept.publicationBlocked, true, `${conceptId} ne doit pas pouvoir être approuvé avant correction.`);
}
const dragonflyStyleReference = natureMedia.find((item) => item.id === "nature-alt-20260715-libellule-manuscript-v2");
assert.equal(dragonflyStyleReference.stage, "reference");
assert.equal(dragonflyStyleReference.publicationBlocked, true);
assert.equal(dragonflyStyleReference.archived, false);
for (const archivedId of ["nature-alt-20260715-libellule-v1", "nature-alt-20260715-libellule-manuscript-v3", "nature-alt-20260715-libellule-manuscript-v4-bilingual"]) {
  const archivedDragonfly = natureMedia.find((item) => item.id === archivedId);
  assert.equal(archivedDragonfly.archived, true, `${archivedId} doit rester conservé mais retiré des propositions actives.`);
  assert.equal(archivedDragonfly.publicationBlocked, true, `${archivedId} ne doit jamais redevenir publiable par réinitialisation.`);
}
assert.deepEqual(
  natureMedia
    .filter((item) => item.eventId === "alt-20260715" && item.stage === "proposal" && item.publicationBlocked !== true && item.archived !== true)
    .map((item) => item.id),
  [correctedDragonfly.id, fieldPlateDragonfly.id],
  "Seules les propositions anatomiquement contrôlées doivent pouvoir être retenues pour la libellule."
);
assert.ok(editorialMedia.some((item) => /\.jpg$/.test(item.fileName)), "Le registre doit accepter les photographies JPEG.");
assert.ok(editorialMedia.some((item) => /\.png$/.test(item.fileName)), "Le registre doit accepter les compositions PNG.");
assert.ok(editorialMedia.some((item) => /\.mp4$/.test(item.fileName) && item.kind === "video"), "Le registre doit accepter les vidéos MP4 déclarées comme telles.");
assert.doesNotMatch(JSON.stringify(editorialMedia), /sharepoint\.com|:\/g\/IQ/i);

for (const token of ["SpeechRecognition", "webkitSpeechRecognition", "getUserMedia", "button[data-dictate]", "data-add-post-calendar", "data-media-form", "cockpit-media-open-label", "cockpit-media-info", "Informations et actions", "cockpit-media-enlarge", "object-fit: contain", "setupMediaNavigation", "data-media-previous", "data-media-next", "glissez les images ou utilisez les flèches", "cockpit:event-context-request", "Chargement des médias liés…", "cockpit-date-elevator", "data-date-target", "requestDateElevatorUpdate", "data-workflow-stage", "workflowDirection", "aria-pressed=\"false\"", "Feu vert retiré; l’historique est conservé.", "id=\"cockpit-task-count\" data-task-count", "Mini-chat de l’événement", "data-resolve-comment", "Voir les messages traités", "comment-task", "data-editorial-decision", "Bonne idée — autre jour", "Ne pas retenir cet angle", "editorial-deferred", "data-comment-thread", "MutationObserver", "Connexion…", "bleu-massawippi-guide-collapsed", "data-guide-new-badge", "setOpportunityStage", "data-opportunity-stage", "bleu-massawippi-projects-collapsed", "setupInternalProjectPreference", "setupInternalProjectEvents", "renderInternalProjectStates", "data-internal-project-stage", "internalProjectUnsubscribe", "Valider le texte avec l’aval", "Le texte et le visuel peuvent avancer en parallèle", "syncResponsiveOffsets", "setAdminSidebarOpen", "--cockpit-session-height"]) {
  assert.ok(ui.includes(token), `Le cockpit doit contenir le contrat ${token}.`);
}
for (const token of ["stateTimestampMillis", "actionTaskPriority", "data-task-target-type", "data-task-updated-at", "cockpit-task-priority", "data-media-updated-at", "dataset.workflowUpdatedAt", "dataset.editorialUpdatedAt", "cockpit-media-blocked", "Référence non diffusable"]) {
  assert.ok(`${ui}\n${taskProgressUi}`.includes(token), `La file priorisée doit exposer le contrat ${token}.`);
}
for (const token of ["roleDecisionForEvent", "roleDecisionModels", "pendingTaskModels", "mediaUpdatedAfterWorkflow", "Pourquoi maintenant", "left.urgency.rank", "Nouvelle consigne de la direction", "Texte prêt pour votre validation"]) {
  assert.ok(viewMode.includes(token), `La vue essentielle doit prioriser les décisions avec ${token}.`);
}
assert.match(viewMode, /if \(role === "admin" && latestTask && !event\.complete && !event\.setAside\)/,
  "Une tâche transmise par la direction doit apparaître seulement dans la file des communications et ne jamais ressusciter une publication terminée ou écartée.");
assert.match(viewMode, /if \(role === "director"\)[\s\S]{0,3200}if \(role === "admin"\)/,
  "Les décisions de la direction et des communications doivent rester séparées par rôle.");
assert.match(viewMode, /event\.media\.latestUpdate > event\.workflowUpdatedAt/,
  "Un média plus récent que la dernière validation doit remonter dans la file de la direction.");
assert.match(viewFixture, /data-workflow-stage="content_review"[\s\S]{0,2500}data-workflow-stage="media_review"/,
  "La recette navigateur doit couvrir séparément les validations du texte et du média.");
assert.match(viewFixture, /data-task-target-type="schedule" data-task-target="fixture-today"/,
  "La recette navigateur doit couvrir une consigne réservée aux communications.");
assert.match(viewFixture, /data-media-updated-at=/,
  "La recette navigateur doit prouver la remontée d’un média récemment modifié.");
for (const token of ["data-opportunity-note-box", "data-save-opportunity-comment", "comment-opportunity-", "Notes partagées sur cette occasion", "renderOpportunityNotes"]) {
  assert.ok(ui.includes(token), `Le suivi individualisé des occasions doit contenir le contrat ${token}.`);
}
for (const token of ["data-internal-project-note-box", "data-internal-project-comment", "data-save-internal-project-comment", "comment-internal-project-", "Commentaires et décisions sur ce projet", "renderInternalProjectNotes"]) {
  assert.ok(ui.includes(token), `Le suivi individualisé des projets internes doit contenir le contrat ${token}.`);
}
for (const token of ["setupFeedbackDictationEvents", "Dicter une recommandation", "Dicter un commentaire sur ce média", "Dicter une note sur le média", "data-voice-container", "voiceContainer"]) {
  assert.ok(ui.includes(token), `Chaque zone de commentaire non technique doit offrir la dictée avec ${token}.`);
}
for (const token of [".posts.single-post", "updateSinglePostLayouts", "sameDay.length === 1", "item.choiceRequired !== true", "!item.optionGroup"]) {
  assert.ok(ui.includes(token), `La pleine largeur des journées confirmées doit contenir le contrat ${token}.`);
}
for (const token of ["data-theme-toggle", "bleu-massawippi-theme", "prefers-color-scheme"]) {
  assert.ok(theme.includes(token), `Le thème doit contenir le contrat ${token}.`);
}
for (const token of ["placeThemeToggle", "in-session"]) {
  assert.ok(theme.includes(token), `Le thème mobile doit contenir le contrat ${token}.`);
}
for (const token of ["addComment", "subscribeComments", "updateOwnComment", "resolveComment", "resolvedByLabel", "commentaire traité", "setWorkflowStage", "setOpportunityStage", "subscribeOpportunityStates", "setInternalProjectStage", "subscribeInternalProjectStates", "internalProjectStates", "validInternalProjectState", "match /internalProjectStates/{projectId}", "setEditorialDecision", "subscribeEditorialDecisions", "editorialDecisions", "addCockpitFeedback", "subscribeMediaLinks", "memoryLocalCache", "withTimeout", "match /comments/{commentId}", "match /workflowStates/{eventId}", "match /opportunityStates/{opportunityId}", "match /editorialDecisions/{eventId}", "match /mediaLinks/{mediaId}"]) {
  assert.ok((client + firestoreRules).includes(token), `Le flux collaboratif doit contenir ${token}.`);
}
assert.equal((source.match(/data-opportunity-id=/g) || []).length, 8);
assert.match(source, /data-project-register[^>]*data-layout-version="2026-07-13-opportunities-notes-v3"/);
assert.match(source, /Échéancier de détection proposé/);
assert.match(source, /ne pas précipiter une candidature 2026 incomplète/i);
assert.match(source, /data-id="document-plan-partenariat-2026-2027"/);
assert.match(source, /Plan de partenariat de Bleu Massawippi/);
assert.match(source, /IQDYGqXjZKD2TJ9oS_ZVTgGfAfUOUb7mKILEyhHLVT9dd7A/);
assert.match(source, /Ouvrir le document/);
assert.match(source, /Télécharger le PDF/);
const mainNav = source.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] || "";
assert.match(mainNav, /<a href="#context-collapsible">Stratégie<\/a>/,
  "Le sommaire doit regrouper le contexte éditorial sous une seule entrée Stratégie.");
assert.doesNotMatch(mainNav, />Lire-moi<\/a>|>Collaboration<\/a>|>Cap<\/a>|>Cadence<\/a>|>Validation<\/a>|Participation photo/,
  "Le sommaire ne doit plus répéter les sous-sections du contexte stratégique ni isoler la participation photo.");
const strategyToc = source.match(/<nav class="strategy-toc"[\s\S]*?<\/nav>/)?.[0] || "";
for (const target of ["readme-collapsible", "strategic-document-plan", "collaboration", "governance-sharepoint-ca", "cap", "cadence", "guide-pratiques-milieu-aquatique-2026", "validation"]) {
  assert.match(strategyToc, new RegExp(`href="#${target}"`), `Le sommaire stratégique doit relier la section ${target}.`);
}
const aquaticGuide = source.match(/<article id="guide-pratiques-milieu-aquatique-2026"[\s\S]*?<\/article>/)?.[0] || "";
assert.match(aquaticGuide, /Guide des bonnes pratiques en milieu aquatique/);
assert.match(aquaticGuide, /outil de référence et non d’un texte réglementaire/);
assert.match(aquaticGuide, /E5A1_A13_B66_2026\.pdf/);
assert.match(aquaticGuide, /quebec\.ca\/agriculture-environnement-et-ressources-naturelles/);
const sharepointGovernance = source.match(/<section id="governance-sharepoint-ca"[\s\S]*?<\/section>/)?.[0] || "";
assert.match(sharepointGovernance, /Deux espaces SharePoint, une seule porte de sortie vers le CA/);
assert.match(sharepointGovernance, /Obtenir deux validations explicites/);
assert.match(sharepointGovernance, /Travail interne : sources, rédaction, validation conjointe et versions prêtes/);
assert.match(sharepointGovernance, /Suivi et historique : registre des décisions, journal du travail et passation/);
assert.match(sharepointGovernance, /05 — Archives/);
assert.match(sharepointGovernance, /Pilotage,%20CA%20et%20continuit%C3%A9/);
assert.match(sharepointGovernance, /CA-ConseilAdministration\/Documents%20partages\/Communications%20-%20documents%20valid%C3%A9s/);
assert.match(sharepointGovernance, /Guide de gouvernance/);
assert.match(sharepointGovernance, /Règles de dépôt du CA/);
assert.match(sharepointGovernance, /class="sharepoint-folder-toggle"[\s\S]*class="plus">\+[\s\S]*class="minus">−/,
  "Le classement SharePoint doit afficher un véritable contrôle + / −, lisible à l’état fermé comme ouvert.");
assert.match(sectionNavigation, /\.strategy-toc a\[href\^="#"\]/,
  "Les raccourcis internes de la stratégie doivent ouvrir leurs panneaux parents avant le défilement.");
assert.match(source, /data-layout-version="2026-07-17-sharepoint-ca-v4"/,
  "La nouveauté stratégique doit être signalée même lorsque le guide reste réduit au démarrage.");
assert.match(source, /Règle permanente des quiz et devinettes/);
for (const id of ["s1d5", "s2d1b", "alt-20260722"]) {
  const quizPost = posts.find((post) => post.id === id);
  assert.ok(quizPost, `Le contenu ludique ${id} doit exister.`);
  assert.equal((quizPost.copy.match(/https:\/\/bleumassawippi\.com\/quiz/g) || []).length, 2,
    `Le contenu ludique ${id} doit proposer le quiz officiel dans ses deux langues.`);
  assert.match(quizPost.copy, /plus de 500 questions/);
  assert.match(quizPost.copy, /more than 500 questions/);
  assert.equal(quizPost.quizDestinationVersion, "bleumassawippi-quiz-v1-2026-07-17");
}
const matchedDonationMedia = editorialMedia.find((media) => media.id === "editorial-don-20260729-double-impact-v2");
assert.ok(matchedDonationMedia, "Le nouveau visuel Zeffy doit être inscrit dans le manifeste éditorial.");
assert.equal(matchedDonationMedia.eventId, donationAppeal.id);
assert.match(matchedDonationMedia.note, /nouvelle adhésion de 100 dollars[\s\S]*fonds spécial/i);
const matchedDonationPreview = path.join(root, "cockpit", "media-previews", "2026-07-22", "doublez-votre-impact-adhesion-v2-preview.webp");
assert.ok(fs.existsSync(matchedDonationPreview), "L’aperçu WebP du nouveau visuel Zeffy doit être publié.");
assert.ok(fs.statSync(matchedDonationPreview).size < 150_000, "L’aperçu Zeffy doit rester léger sur mobile.");
assert.doesNotMatch(posts.find((post) => post.id === "s4d7").copy, /bleumassawippi\.com\/quiz/,
  "Un sondage qui mentionne éventuellement un quiz ne doit pas être transformé en publication quiz.");
assert.equal((source.match(/data-internal-project-id=/g) || []).length, 18, "Le registre privé doit contenir les dix-huit projets internes documentés.");
assert.match(source, /data-internal-project-register[^>]*data-layout-version="2026-09-01-archives-v1"/);
const internalProjectIds = [...source.matchAll(/data-internal-project-id="([a-z0-9-]+)"/g)].map((match) => match[1]).sort();
assert.ok(internalProjectIds.includes("nettoyage-berges-2026"), "Le projet de nettoyage des berges 2026 doit être présent dans le registre.");
const shorelineCleanupProject = source.match(/<details class="internal-project urgent" id="internal-project-nettoyage-berges-2026"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(shorelineCleanupProject, /Nettoyage des berges — North Hatley et Ayer’s Cliff/);
assert.match(shorelineCleanupProject, /19 septembre/);
assert.match(shorelineCleanupProject, /20 septembre/);
assert.match(shorelineCleanupProject, /COGESAF/);
assert.match(shorelineCleanupProject, /North Hatley n’a pas encore répondu/);
assert.match(shorelineCleanupProject, /NettoyageBerges_projet2026_BM\.docx/);
assert.equal((shorelineCleanupProject.match(/class="internal-project-document-card"/g) || []).length, 4,
  "Le projet de nettoyage doit présenter le document maître, le dossier SharePoint, son index et le gabarit réutilisable sous forme de cartes.");
assert.match(shorelineCleanupProject, /LIRE_DABORD_Nettoyage_des_berges_2026\.md/);
assert.match(shorelineCleanupProject, /Gabarit%20dossier%20projet%20-%20%C3%A0%20copier/);
const internalProjectSeedIds = [...internalProjectSeed.matchAll(/^  "([a-z0-9-]+)": "(?:to_frame|planned|active|blocked|completed)"[,]?$/gm)].map((match) => match[1]).sort();
assert.deepEqual(internalProjectSeedIds, internalProjectIds, "Les cartes et le seed des projets internes doivent utiliser exactement les mêmes identifiants.");
assert.match(source, /data-internal-project-id="jeux-provinciaux-peche" data-initial-stage="completed"/,
  "Les Jeux provinciaux de pêche doivent rester classés comme projet terminé dans la source.");
assert.match(source, /Jeux provinciaux de pêche — événement terminé[\s\S]{0,180}Terminé · archivé/,
  "La fiche des Jeux provinciaux de pêche doit annoncer clairement sa clôture.");
assert.match(internalProjectSeed, /"jeux-provinciaux-peche": "completed"/,
  "Le seed ne doit jamais recréer les Jeux provinciaux de pêche comme projet actif ou bloqué.");
assert.match(source, /data-internal-project-id="poesie-du-lac" data-initial-stage="completed"/,
  "Au bord du bleu doit rester classé comme projet terminé dans la source de repli.");
assert.match(source, /AU_BORD_DU_BLEU_INDEX_CLOTURE_ARCHIVES_2026-09-01\.md/,
  "La fiche archivée doit exposer son index final de clôture.");
assert.match(source, /ARCHIVES%20-%20cl%C3%B4ture%20finale%20-%202026-09-01/,
  "La fiche archivée doit mener au dossier SharePoint final sans exposer le lien photo privé.");
const applicationProject = source.match(/<details class="internal-project" id="internal-project-application-carte-vivante-lac"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(applicationProject, /data-waiting-source="functional-spec-pending"/);
assert.match(applicationProject, /ÉCOACTION À QUALIFIER · 23 SEPT\. · AUCUNE PRODUCTION/);
assert.match(applicationProject, /Décision de préqualification/);
assert.match(applicationProject, /Aucun fichier ni contenu correspondant n’a été reçu dans communication@ ou dans le Cockpit/);
assert.match(applicationProject, /aucune validation, approbation ou action de production n’est déduite/);
assert.match(applicationProject, /Cahier des charges fonctionnel/);
assert.match(applicationProject, /Rétroaction · 19–20 août · fichier non reçu/);
assert.match(applicationProject, /résumé « Prototype Alpha 0\.0\.1 » reçu d’Annie est maintenant intégré au cadrage/);
assert.match(applicationProject, /estimation de 60–80 % doit être vérifiée livrable par livrable/);
assert.match(applicationProject, /Aucun code, prototype fonctionnel, achat, partenaire, échéance publique ni lancement n’est autorisé/);
assert.match(applicationProject, /Cadrage_application_Massawippi_en_partage_2026-08-17\.md/);
assert.match(applicationProject, /Note_decision_EcoAction_carte_vivante_2026-09-02\.md/);
assert.match(applicationProject, /Inventaire_courriels_Annie_application_2026-09-02\.md/);
assert.match(applicationProject, /Découverte à documenter, pas à développer/);
assert.match(applicationProject, /application-reference-lakepulse/);
assert.match(applicationProject, /dernière date de prélèvement au 11 juillet 2017/,
  "L’observation transmise par la direction doit rester attribuée à la fiche consultée.");
assert.match(applicationProject, /source, sa date, sa fréquence de mise à jour et son niveau de fraîcheur/,
  "La piste LakePulse doit produire un garde-fou explicite sur la fraîcheur des données.");
assert.match(applicationProject, /ne doivent pas servir directement à la recherche scientifique/,
  "Le cockpit ne doit pas présenter les résultats de diffusion de LakePulse comme des données scientifiques actuelles.");
assert.match(applicationProject, /Yannick Huot/);
assert.match(applicationProject, /https:\/\/lakepulse\.ca\/lakeportal\/fr\//);
assert.match(applicationProject, /usherbrooke\.ca\/geomatique\/departement\/personnel\/personnel-enseignant\/yannick-huot/);
assert.match(applicationProject, /Prendre contact seulement après un premier cadrage, un intérêt municipal et une piste de financement/,
  "La référence universitaire doit demeurer une piste conditionnelle, pas un partenariat annoncé.");
const fundProject = source.match(/<details class="internal-project" id="internal-project-fonds-environnemental"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(fundProject, /fonds-environnemental-partenarial/);
assert.match(fundProject, /Environnement en actions/);
assert.match(fundProject, /Scénario A · Fonds affecté à l’OBNL/);
assert.match(fundProject, /Scénario B · Fonds municipal/);
assert.match(fundProject, /Scénario C · Initiative conjointe/);
assert.match(fundProject, /Direction générale — environ 1 h 30 avant décision/);
assert.match(fundProject, /Communications — environ 5 à 7 h avant recommandation/);
const interlakeProject = source.match(/<details class="internal-project" id="internal-project-colloque-reseautage"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(interlakeProject, /Colloques et collaboration interlacs/);
assert.match(interlakeProject, /D’un lac à l’autre/);
assert.match(interlakeProject, /Table québécoise d’expertise sur les lacs/);
assert.match(interlakeProject, /Direction générale — environ 2 à 3 h pour le cadrage/);
assert.match(interlakeProject, /Communications — environ 12 à 18 h pour un pilote/);
const photoProject = source.match(/<details class="internal-project" id="internal-project-regards-massawippi"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(photoProject, /data-internal-project-id="participation-photo-regards-massawippi"/);
assert.match(photoProject, /Vos regards sur le Massawippi — participation photo communautaire/);
assert.match(photoProject, /appel éditorial pilote de quatre semaines/i);
assert.match(photoProject, /Direction générale — environ 25 minutes pour le pilote/);
assert.match(photoProject, /Communications — environ 5 à 7 heures pour le pilote/);
assert.match(photoProject, /Consentement et droits/);
assert.match(photoProject, /data-internal-project-controls/);
assert.doesNotMatch(source, /<section[^>]*id="photo"/,
  "La participation photo ne doit plus survivre comme section isolée hors des projets internes.");
const holidayCardProject = source.match(/<details class="internal-project" id="internal-project-carte-fetes-2026"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(holidayCardProject, /Carte des Fêtes 2026 — remercier les membres/);
assert.match(holidayCardProject, /photographie hivernale réelle/i);
assert.match(holidayCardProject, /mot d’Annie écrit à la main/i);
assert.match(holidayCardProject, /environ 200 cartes reste une hypothèse/i);
assert.match(holidayCardProject, /Aucune donnée personnelle n’est versée dans le cockpit/i);
assert.match(holidayCardProject, /CARTE_DES_FETES_2026_CADRAGE_INTERNE_2026-08-24\.md/);
const poetryProject = source.match(/<details class="internal-project" id="internal-project-poesie-du-lac"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(poetryProject, /réseau d’acteurs, de poètes, de slameurs et d’interprètes/,
  "Le réseau professionnel mobilisable doit être décrit sans réduire le projet à un appel public.");
assert.match(poetryProject, /Au bord du bleu/);
assert.match(poetryProject, /ÉVÉNEMENT TENU/);
assert.match(poetryProject, /Suivi post-événement/);
assert.match(poetryProject, /Aucune action opérationnelle ouverte/,
  "La fiche archivée ne doit plus afficher une action opérationnelle comme encore ouverte.");
assert.match(poetryProject, /Registre_consentements_post-evenement_2026-08-31\.md/);
assert.match(poetryProject, /Suivi_post-evenement_2026-08-31\.md/);
assert.match(poetryProject, /dimanche 30 août/i);
assert.match(poetryProject, /13 h à 16 h/i);
assert.match(poetryProject, /programme public d’environ une à deux heures/i);
assert.match(poetryProject, /Passages de 5 à 15 minutes/);
assert.match(poetryProject, /partie engazonnée du parc distincte/i);
assert.match(poetryProject, /distincte de la bande riveraine fermée/i);
assert.match(poetryProject, /Cible : 0 \$/);
assert.match(poetryProject, /Plafond prudent : 250 \$ maximum/);
assert.match(poetryProject, /Direction générale — fermeture du matin/);
assert.match(poetryProject, /Communications — conduite et accueil/);
assert.match(poetryProject, /internal-project-poster-featured/);
assert.match(poetryProject, /internal-project-poster-pair/,
  "Le projet doit conserver une zone d’affiche finale clairement identifiable.");
assert.equal((poetryProject.match(/class="internal-project-poster internal-project-poster-featured"/g) || []).length, 1,
  "Le projet doit exposer exactement une affiche finale, sans afficher les versions archivées.");
assert.match(source, /\.internal-project-poster-featured \{ grid-template-columns:minmax\(260px,440px\) minmax\(0,1fr\)/,
  "Les affiches doivent conserver une présentation lisible sur ordinateur.");
assert.match(source, /\.internal-project-poster-pair \{ display:grid; grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  "Les deux affiches doivent être disposées côte à côte lorsque l’espace le permet.");
assert.match(source, /internal-project-poster-pair\{grid-template-columns:1fr\}/,
  "Les affiches doivent s’empiler sur mobile.");
assert.match(source, /internal-project>summary \.internal-project-priority\{max-width:100%;white-space:normal;overflow-wrap:anywhere\}/,
  "Les libellés de priorité longs doivent se replier sur mobile sans être tronqués.");
assert.doesNotMatch(poetryProject, /affiche-au-bord-du-bleu-photo-reelle-v7-bilingue(?:-apercu\.webp|\.png)|appel aux voix archivé/,
  "L’affiche de recrutement V7 doit rester archivée dans les fichiers sans être exposée dans la fiche active.");
assert.match(poetryProject, /affiche-au-bord-du-bleu-photo-reelle-v8-evenement-bilingue-apercu\.webp/);
assert.match(poetryProject, /affiche-au-bord-du-bleu-photo-reelle-v8-evenement-bilingue\.png/);
assert.match(poetryProject, /Affiche finale de l’événement/);
assert.match(poetryProject, /v8-evenement-bilingue-apercu\.webp[^>]+loading="eager"[^>]+fetchpriority="high"/,
  "L’affiche événementielle courante doit être chargée immédiatement.");
const currentPoetryPoster = poetryProject.match(/<figure class="internal-project-poster internal-project-poster-featured"><a href="[^"]*v8-evenement-bilingue\.png"[\s\S]*?<\/figure>/)?.[0] || "";
assert.ok(currentPoetryPoster, "La carte de l’affiche événementielle V8 doit être isolable pour le contrôle éditorial.");
const currentPoetryPosterImage = currentPoetryPoster.match(/<img[^>]+>/)?.[0] || "";
assert.doesNotMatch(currentPoetryPosterImage, /appel aux voix|call for voices|candidatures|apply by/i,
  "Le contenu décrit par l’affiche événementielle courante ne doit plus annoncer de recrutement ni d’inscription.");
assert.match(currentPoetryPoster, /sans appel aux voix ni mention d’inscription/i,
  "La légende doit expliquer clairement pourquoi cette version remplace l’affiche de recrutement.");
assert.doesNotMatch(poetryProject, /v6-fr|v6-en|Affiche française|English poster/,
  "Les affiches V6 doivent être conservées dans les fichiers sans rester visibles dans le cockpit.");
assert.match(poetryProject, /Partenaires et commandites — visibilité utile, indépendance préservée/);
assert.match(poetryProject, /aucune visibilité ne donne un droit de regard sur la sélection artistique/i);
assert.doesNotMatch(poetryProject, /ADDENDUM_VISUEL_PARTENAIRES_AU_BORD_DU_BLEU_V5\.md/,
  "L’ancien addendum doit demeurer archivé sans encombrer les documents actifs.");
assert.match(poetryProject, /data-initial-stage="completed"/,
  "La fiche poésie doit être archivée sans être forcée ouverte dans le registre courant.");
assert.match(poetryProject, /ARCHIVÉ · ÉVÉNEMENT TENU LE 30 AOÛT 2026 · SUCCÈS CONFIRMÉ/);
assert.match(poetryProject, /Quatorze personnes uniques recensées; treize contributions actives au décompte public/i);
assert.match(poetryProject, /Douze artistes sont prévus sur place; la treizième contribution est le texte final de Heather, lu par Valentin en son absence/i);
assert.match(poetryProject, /Mélissa, la chanteuse, est déjà comprise dans ces douze/i);
assert.match(poetryProject, /Denis n’est pas compris dans les douze/i);
assert.match(poetryProject, /douze sacs de collation : un pour chaque artiste sur place/i);
assert.match(poetryProject, /Karrie Parent a confirmé directement le même soir qu’elle reprend <em>La femme phoque<\/em> à effectif constant/i);
assert.match(poetryProject, /il n’y aura pas de micro ouvert ni d’inscription spontanée sur place/i);
assert.doesNotMatch(poetryProject, /poesie-rencontre-north-hatley-2026-08-10/,
  "L’ancienne rencontre doit rester dans l’historique sans être exposée dans le paquet final.");
assert.match(poetryProject, /appliquer la checklist de clôture du 29 août/i,
  "La prochaine action doit utiliser la clôture opérationnelle la plus récente.");
assert.match(poetryProject, /Karrie a confirmé directement le 28 août à 21 h 41/i,
  "La confirmation directe de la remplaçante doit être reflétée sans ambiguïté.");
assert.match(poetryProject, /Pour Douce, Florence et François, confirmer oralement présence, titre ou prononciation et durée sans inventer/i,
  "Les trois absences de réponse individuelle doivent rester visibles comme pointage oral, pas comme désistement.");
assert.match(poetryProject, /aucun lieu de repli n’est confirmé/i,
  "La fiche interne doit rendre explicite l’absence de plan météo confirmé.");
assert.match(poetryProject, /Décision météo entre 9 h 40 et 10 h, puis message unique/,
  "La fiche interne doit conserver une chaîne de décision météo explicite.");
assert.doesNotMatch(poetryProject, /église de repli|repli à l’intérieur de l’église|repli retenu est l’intérieur de l’église/i,
  "La fiche interne ne doit plus présenter l’église comme lieu de repli confirmé.");
assert.doesNotMatch(poetryProject, /Parc du Quai et Saint-Barthélemy demeurent les premiers replis à étudier/,
  "Les anciens scénarios de repli doivent être retirés de la fiche active.");
assert.match(source, /Registre_operationnel_donateurs_et_adherents_2025-09-01_au_2026-08-31\.xlsx/);
assert.match(source, /Audit_et_corrections_Zeffy_2026-08-31\.md/);
assert.match(source, /id="soutien-mission-20260920"/);
assert.match(source, /Dossier_soutien_mission_2026-09-20\.md/);
assert.match(source, /Liste_membres_demande_subvention_INTERNE_2025-09-01_au_2026-08-31\.xlsx/);
assert.match(source, /123 personnes retenues/);
assert.match(source, /quatre courriels absents des sources restent à confirmer/);
assert.match(source, /Canada Helps est exclu comme intermédiaire de paiement/);
for (const meetingTopic of ["Lieu et autorité", "Horaire et logistique", "Météo et décision", "Collaboration et visibilité"]) {
  assert.match(meetingBriefBuilder, new RegExp(meetingTopic), `Le PDF municipal doit couvrir : ${meetingTopic}.`);
}
assert.doesNotMatch(poetryProject, /<details[^>]+id="poesie-rencontre-north-hatley-2026-08-10"/,
  "L’aide-mémoire ne doit plus occuper un long encart dans la fiche du projet.");
assert.doesNotMatch(poetryProject, /Aide_memoire_rencontre_North_Hatley_Au_bord_du_bleu_2026-08-10\.pdf|Aide-mémoire — rencontre du 10 août/);
assert.equal((poetryProject.match(/class="internal-project-document-card"/g) || []).length, 17,
  "La fiche archivée doit présenter les douze ressources finales, les trois suivis post-événement et les deux accès de clôture.");
assert.equal((poetryProject.match(/class="internal-project-document-kind"/g) || []).length, 17,
  "Chaque carte documentaire doit annoncer clairement son type.");
assert.equal((poetryProject.match(/class="internal-project-document-action"/g) || []).length, 17,
  "Chaque ressource spécialisée doit proposer un bouton d’ouverture explicite.");
for (const archivedOperationalDocument of [
  "TEXTE_PARTENAIRES_MUNICIPALITES_AU_BORD_DU_BLEU_2026-08-10.md",
  "AU_BORD_DU_BLEU_REGISTRE_CANDIDATURES_2026-08-11.md",
  "AU_BORD_DU_BLEU_LOGISTIQUE_ET_CONDUCTEUR_2026-08-11.md",
  "AU_BORD_DU_BLEU_MESSAGES_ARTISTES_BROUILLONS_2026-08-11.md"
]) {
  assert.doesNotMatch(poetryProject, new RegExp(archivedOperationalDocument.replaceAll(".", "\\.")),
    `L’outil antérieur ${archivedOperationalDocument} doit rester archivé sans être exposé dans le paquet final.`);
}
const meetingBriefPdf = path.join(root, "cockpit", "project-documents", "Aide_memoire_rencontre_North_Hatley_Au_bord_du_bleu_2026-08-10.pdf");
assert.ok(fs.existsSync(meetingBriefPdf), "Le PDF d’aide-mémoire doit être publié avec le cockpit.");
assert.ok(fs.statSync(meetingBriefPdf).size > 50_000, "Le PDF d’aide-mémoire doit contenir sa mise en page et le logo.");
assert.doesNotMatch(poetryProject, /https:\/\/forms\.office\.com\/r\/4A2xsMh7st/,
  "Le formulaire public clos ne doit plus être exposé comme document courant.");
assert.match(poetryProject, /Quatorze personnes uniques recensées; treize contributions actives/);
assert.match(poetryProject, /Annick a retiré sa lecture et viendra comme spectatrice/);
assert.match(poetryProject, /ne doit pas être réinséré sans nouvelle confirmation explicite/);
assert.match(poetryProject, /Aucune prise de parole n’est attribuée à Annie sans son accord/);
assert.match(poetryProject, /l’accueil bilingue à 13 h 20 et la première lecture à 13 h 27, au plus tard à 13 h 30/i);
assert.match(poetryProject, /Le passage de Myriam reste à 14 h 05/i);
assert.match(poetryProject, /Le programme formel se termine à 15 h 25/i);
assert.doesNotMatch(poetryProject, /13 h 42/);
assert.doesNotMatch(poetryProject, /Au_bord_du_bleu_checklist_operationnelle_2026-08-17\.md/);
assert.match(poetryProject, /Dispositif confirmé : un microphone et un haut-parleur adaptés à l’événement/);
assert.match(poetryProject, /Deux aides supplémentaires pour le montage des tentes/);
assert.match(poetryProject, /Deux bénévoles au kiosque à partir de 13 h/);
assert.doesNotMatch(poetryProject, /AU_BORD_DU_BLEU_GUIDE_TERRAIN_2026-08-24\.pdf/);
assert.doesNotMatch(poetryProject, /AU_BORD_DU_BLEU_CONDUCTEUR_INTERNE_2026-08-24\.md/);
assert.doesNotMatch(poetryProject, /AU_BORD_DU_BLEU_REGISTRE_CANONIQUE_2026-08-24\.md/);
assert.match(poetryProject, /AU_BORD_DU_BLEU_GUIDE_TERRAIN_2026-08-29\.pdf/);
assert.match(poetryProject, /AU_BORD_DU_BLEU_CONDUCTEUR_INTERNE_2026-08-29\.md/);
assert.match(poetryProject, /AU_BORD_DU_BLEU_REGISTRE_CANONIQUE_2026-08-29\.md/);
assert.match(poetryProject, /AU_BORD_DU_BLEU_RECONCILIATION_COURRIELS_2026-08-29\.md/);
assert.match(poetryProject, /AU_BORD_DU_BLEU_CHECKLIST_VEILLE_2026-08-29\.md/);
assert.match(poetryProject, /AU_BORD_DU_BLEU_MANIFESTE_LIVRABLES_COURANTS_2026-08-29\.md/);
assert.match(poetryProject, /SOURCES_PRESENTATIONS_ARTISTES_2026-08-29\.md/,
  "La note de sources des présentations enrichies doit rester accessible depuis le projet.");
assert.match(poetryProject, /PDF · 29 août · 23 pages · verrouillé/i);
assert.match(poetryProject, /accueil bilingue/i);
assert.match(poetryProject, /transitions-présentations/i);
assert.match(poetryProject, /Guide personnel de Valentin — conduite chronologique complète/i);
assert.match(poetryProject, /<em>Sanctuary<\/em>/i);
assert.match(poetryProject, /affiches QR et matériel du remerciement restent conservés/i,
  "La clôture doit conserver les supports imprimés sans réécrire leurs destinations.");
assert.doesNotMatch(poetryProject, /guide terrain PDF de 21 pages/i);
assert.doesNotMatch(poetryProject, /PDF de 20 pages/i);
assert.doesNotMatch(poetryProject, /treize paniers/i);
assert.match(poetryProject, /Guide%20terrain%20final%20-%202026-08-29%20-%20cl%C3%B4ture%20veille/,
  "Les documents courants doivent ouvrir la clôture SharePoint du 29 août.");
assert.match(poetryProject, /PLAN_IMPLANTATION_SCHEMATIQUE_2026-08-23\.svg/);
assert.match(poetryProject, /Textes%20finaux%20re%C3%A7us/);
assert.doesNotMatch(poetryProject, /Guide%20terrain%20final%20-%202026-08-28/,
  "Les textes finaux doivent désormais ouvrir le sous-dossier du paquet courant, pas celui du 28 août.");
assert.match(poetryProject, /alimentation autonome sur batterie est le plan de base/i);
assert.match(poetryProject, /toilette sèche située près de la station de lavage/i);
assert.match(poetryProject, /160, rue Main, North Hatley \(Québec\) J0B 2C0/i);
assert.match(poetryProject, /stationnement municipal gratuit en haut de la rue School/i);
assert.match(poetryProject, /douze sacs de collation/i);
assert.match(poetryProject, /ni robinet ni point d’eau potable au parc/i);
const poetryCalendarEvent = projectCalendarEvents.events.find((event) => event.id === "au-bord-du-bleu-evenement-20260830");
assert.ok(poetryCalendarEvent, "L’événement Au bord du bleu doit rester relié au calendrier des projets.");
assert.equal(poetryCalendarEvent.location, "Parc Lôbadanaki, 160, rue Main, North Hatley (Québec) J0B 2C0");
assert.match(poetryCalendarEvent.summary, /installation à partir de 11 h/i);
assert.match(poetryCalendarEvent.summary, /douze sacs de collation/i);
assert.match(poetryCalendarEvent.summary, /aucun lieu de repli n’est confirmé/i);
assert.match(poetryProject, /IgAExHf2zrycTY-KL1qggcPMAXaRvpSpD6eY2vuzbHo68_E/,
  "Le projet poésie doit proposer le dépôt public en téléversement seulement, déjà testé sans connexion.");
assert.doesNotMatch(poetryProject, /IgClI0cmRbRbT6ODUJPWldffAXESMwjOikVa3X9vvn69oSw/,
  "L’ancien lien personnel de dépôt ne doit plus rester dans la fiche active.");
assert.match(poetryProject, /Ouvrir le dépôt photos et vidéos ↗/);
for (const eventPoster of [
  "Au_bord_du_bleu_affiche_dons_Zeffy_2026-08-30.pdf",
  "Au_bord_du_bleu_affiche_depot_photos_videos_2026-08-30.pdf",
  "affiche-dons-zeffy-au-bord-du-bleu-2026-08-30-preview.webp",
  "affiche-depot-photos-videos-au-bord-du-bleu-2026-08-30-preview.webp"
]) {
  assert.match(poetryProject, new RegExp(eventPoster.replaceAll(".", "\\.")),
    `La ressource événementielle ${eventPoster} doit rester accessible depuis le projet poésie.`);
}
assert.match(poetryProject, /Faire un don à Bleu Massawippi/);
assert.match(poetryProject, /Partager les photos et vidéos de l’événement/);
assert.match(poetryProject, /boîte de dépôt SharePoint/i);
for (const posterPdf of [
  "project-documents/Au_bord_du_bleu_affiche_dons_Zeffy_2026-08-30.pdf",
  "project-documents/Au_bord_du_bleu_affiche_depot_photos_videos_2026-08-30.pdf"
]) {
  const posterPath = path.join(root, posterPdf);
  assert.ok(fs.existsSync(posterPath), `L’affiche imprimable doit exister : ${posterPdf}`);
  assert.ok(fs.statSync(posterPath).size > 50_000, `L’affiche imprimable doit contenir sa mise en page : ${posterPdf}`);
}
assert.doesNotMatch(poetryProject, /microphones-cravates|micros-cravates/i,
  "La fiche active ne doit pas réintroduire le micro facultatif non confirmé.");
assert.match(poetryProject, /forms\.cloud\.microsoft\/Pages\/DesignPageV2\.aspx\?origin=NeoPortalPage&amp;subpage=design&amp;id=[^\"]+&amp;analysis=true/,
  "Le projet poésie doit donner accès aux réponses recueillies dans Microsoft Forms.");
assert.match(poetryProject, /Voir les réponses ↗/);
assert.equal((source.match(/class="internal-project-form-results"/g) || []).length, 1,
  "Le raccourci vers les réponses doit apparaître une seule fois, dans le projet poésie.");
assert.match(poetryProject, /href="#poesie-du-lac-fiche-operationnelle"/);
assert.doesNotMatch(poetryProject, /Je protège mon Massawippi|date de fin d’été|au coucher du soleil|concept-v1/,
  "La fiche poésie ne doit pas réintroduire le thème, le créneau ou l’affiche abandonnés.");
assert.ok(poetryProject.indexOf("internal-project-poster") < poetryProject.indexOf("internal-project-capacity"),
  "L’affiche doit précéder le développement de la fiche afin d’être visible dès l’ouverture du projet.");
for (const asset of [
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v7-bilingue-apercu.webp",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v7-bilingue.png",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v8-evenement-bilingue-apercu.webp",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v8-evenement-bilingue.png",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v6-fr-apercu.webp",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v6-fr.png",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v6-en-apercu.webp",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v6-en.png",
  "cockpit/assets/projects/poesie-du-lac/poesie-au-bord-du-bleu-lac-massawippi-photo-dji-0100-preview.webp"
]) assert.ok(fs.existsSync(path.join(root, asset)), `Le livrable poésie doit exister : ${asset}`);
for (const preview of [
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v7-bilingue-apercu.webp",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v8-evenement-bilingue-apercu.webp"
]) assert.ok(fs.statSync(path.join(root, preview)).size < 180_000,
  `Chaque aperçu bilingue du projet poésie doit rester léger sur mobile : ${preview}`);
const poetryMedia = editorialMedia.filter((media) => media.eventId === "poesie-20260727-appel-aux-voix");
const activePoetryMedia = poetryMedia.filter((media) => media.archived !== true);
assert.deepEqual(activePoetryMedia.map((media) => media.id), ["editorial-poesie-20260727-affiche-bilingue-v7"],
  "Le post du 27 juillet doit proposer exactement une affiche bilingue active.");
assert.deepEqual(
  poetryMedia.filter((media) => media.archived === true).map((media) => media.id).sort(),
  ["editorial-poesie-20260727-appel-v5", "editorial-poesie-20260727-lac-reel-dji0100"],
  "Les deux anciens médias doivent rester enregistrés mais archivés.");
assert.ok(fs.statSync(path.join(root, "cockpit/assets/projects/poesie-du-lac/poesie-au-bord-du-bleu-lac-massawippi-photo-dji-0100-preview.webp")).size < 150_000,
  "L’aperçu de la photographie authentique doit rester léger sur mobile.");
const youthProject = source.match(/<details class="internal-project" id="internal-project-concours-dessin-jeunesse"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(youthProject, /Le lac dans tes yeux — concours-exposition de dessin jeunesse/);
assert.match(youthProject, /data-initial-stage="planned" open/);
assert.match(youthProject, /REPORTÉ · AVRIL 2027/);
assert.match(youthProject, /sans démarche auprès des écoles en 2026/i);
assert.match(youthProject, /activité adaptable de 45 à 90 minutes/i);
assert.match(youthProject, /Saint-Barthélemy et Ayer’s Cliff Elementary/);
assert.match(youthProject, /Toutes les œuvres admissibles et autorisées/);
assert.match(youthProject, /aucun vote public/i);
assert.match(youthProject, /Aucune adresse familiale ni coordonnée d’enfant/);
assert.match(youthProject, /L’enfant conserve le droit d’auteur/);
assert.match(youthProject, /photo de la frise exige l’autorisation de chaque œuvre visible/);
assert.match(youthProject, /Direction générale — environ 1 h 30 avant lancement/);
assert.match(youthProject, /Communications — environ 12 à 18 h avant lancement/);
assert.match(youthProject, /Dix outils versionnés sont regroupés dans deux documents internes/);
assert.match(youthProject, /Dossier_operationnel_le_lac_dans_tes_yeux_v1\.pdf/);
assert.match(youthProject, /Trousse_ecoles_le_lac_dans_tes_yeux_v1\.pdf/);
const lakeHealthProject = source.match(/<details class="internal-project" id="internal-project-bilan-sante"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(lakeHealthProject, /Nature Cantons-de-l’Est \(NCE\)/,
  "Le bilan de santé doit nommer le prestataire externe indiqué par la direction.");
const beachMonitoringProject = source.match(/<details class="internal-project" id="internal-project-cyanobacteries"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(beachMonitoringProject, /Ayer’s Cliff demeure une seconde municipalité envisagée/,
  "Le suivi des plages doit conserver Ayer’s Cliff comme piste sans créer d’engagement.");
assert.match(beachMonitoringProject, /aucun service n’est présenté comme convenu/,
  "La piste Ayer’s Cliff ne doit pas transformer une discussion en engagement.");
const pagesWorkflow = fs.readFileSync(path.join(root, ".github/workflows/deploy-pages.yml"), "utf8");
assert.match(pagesWorkflow, /cp -R cockpit\/assets public\/assets/,
  "GitHub Pages doit publier les visuels des projets internes.");
for (const applicationDocument of [
  "Cadrage_application_Massawippi_en_partage_2026-08-17.md",
  "Note_decision_EcoAction_carte_vivante_2026-09-02.md",
  "Inventaire_courriels_Annie_application_2026-09-02.md"
]) {
  assert.ok(fs.existsSync(path.join(root, "project-documents", applicationDocument)), `Le document d’application doit exister : ${applicationDocument}`);
  assert.ok(pagesWorkflow.includes(`cp project-documents/${applicationDocument} public/project-documents/`), `Le document d’application doit être livré par GitHub Pages : ${applicationDocument}`);
}
for (const stage of ["to_frame", "planned", "active", "blocked", "completed"]) {
  assert.ok(client.includes(`"${stage}"`) && firestoreRules.includes(`'${stage}'`) && internalProjectSeed.includes(`"${stage}"`), `L’étape interne ${stage} doit rester alignée entre client, règles et initialisation.`);
}
assert.equal((internalProjectSeed.match(/^  "[a-z0-9-]+": "(?:to_frame|planned|active|blocked|completed)"[,]?$/gm) || []).length, 18, "Le seed initial doit couvrir les dix-huit projets internes documentés.");
assert.match(source, /REGISTRE_FINANCEMENT_PARTENARIATS_2026-08-24\.md/,
  "Le registre de financement par projet doit rester accessible depuis les occasions à saisir.");
assert.match(source, /piste de nettoyage des berges attribuée à COGESAF demeure explicitement <em>à sourcer<\/em>/i,
  "Le cockpit ne doit pas présenter les montants COGESAF non sourcés comme acquis.");
assert.equal(internalProjectDocuments.documents.length, 14, "Les quatorze dossiers déjà publiés doivent rester raccordés à leur projet interne.");
assert.equal(new Set(internalProjectDocuments.documents.map((item) => item.id)).size, 14, "Chaque dossier partageable doit viser un projet distinct.");
assert.equal(internalProjectDocuments.redaction, "Valentin Wittwe, directeur des communications, Bleu Massawippi");
for (const document of internalProjectDocuments.documents) {
  assert.ok(internalProjectIds.includes(document.id), `Le dossier ${document.id} doit correspondre à une fiche du cockpit.`);
  assert.match(document.file, /^Proposition_assainie_.+\.pdf$/);
  assert.match(document.url, /^(?:https:\/\/bleumassawippi\.sharepoint\.com\/:b:\/g\/|\.\/project-documents\/)/);
  assert.ok(ui.includes(document.url), `Le dossier ${document.id} doit être raccordé à son bouton dans l’interface.`);
}
for (const asset of [
  "cockpit/project-documents/Proposition_assainie_fonds-environnemental-partenarial_v1.pdf",
  "cockpit/project-documents/Proposition_assainie_colloque-reseautage-associations_v2.pdf"
]) {
  const fullPath = path.join(root, asset);
  assert.ok(fs.existsSync(fullPath), `Le nouveau dossier PDF doit exister : ${asset}`);
  assert.ok(fs.statSync(fullPath).size > 10_000, `Le nouveau dossier PDF doit contenir une proposition substantielle : ${asset}`);
}
assert.match(ui, /decorateInternalProjectDocuments/);
assert.match(ui, /Ouvrir le dossier de proposition assaini/);
assert.match(internalProjectSeed, /if \(existing\.exists\) \{[\s\S]{0,120}preserved \+= 1;[\s\S]{0,80}continue;/, "Le seed des projets internes doit préserver tout état collaboratif existant.");
for (const collectionName of ["opportunityStates", "internalProjectStates"]) {
  assert.match(adminSync, new RegExp(`readRecent\\("${collectionName}"\\)`), `Le résumé local doit lire ${collectionName}.`);
  assert.match(adminSync, new RegExp(`${collectionName}: ${collectionName}\\.map`), `Le résumé local doit restituer ${collectionName}.`);
}
assert.doesNotMatch(ui, /data-attachment-input|uploadImageAttachment|subscribeImageAttachments/);
assert.doesNotMatch(client, /firebase-storage|uploadBytes|getDownloadURL/);
assert.doesNotMatch(ui + client, /data-attachment-input|seed_open_house_attachments/);
assert.match(ui, /data-monthly-post-state=/, "Chaque publication de l’aperçu mensuel doit exposer son état calculé.");
assert.match(ui, /Légende de l’état des publications/, "L’aperçu mensuel doit expliquer ses trois icônes.");
for (const label of ["Nouvelle proposition", "En cours d’édition", "Publié ou programmé"]) {
  assert.match(monthlySnapshotState, new RegExp(label), `La légende mensuelle doit conserver l’état « ${label} ».`);
}
assert.doesNotMatch(monthlySnapshotState, /subscribe|onSnapshot|getDoc|firebase/i,
  "La classification mensuelle doit réutiliser les données déjà chargées sans requête Firebase supplémentaire.");
assert.match(firebaseConfig, /apiKey:\s*"AIza[A-Za-z0-9_-]{20,}"/);
assert.doesNotMatch(firebaseConfig, /GEMINI|gemini_api_key/i);
const seedContentFieldsMatch = privateContentSeed.match(/const contentFields = \{([\s\S]*?)\r?\n  \};\r?\n  if \(existing\.exists\)/);
assert.ok(seedContentFieldsMatch, "Le seed doit isoler les champs éditoriaux des états collaboratifs.");
for (const field of ["status", "deleted", "selected", "updatedAt", "updatedBy"]) {
  assert.doesNotMatch(seedContentFieldsMatch[1], new RegExp(`\\b${field}\\s*:`), `Le seed ne doit pas placer ${field} dans les champs fusionnés aux événements existants.`);
}
assert.match(privateContentSeed, /const changedFields = Object\.keys\(contentFields\)/, "Le seed doit détecter les changements réels avant d’horodater un événement.");
assert.match(privateContentSeed, /entityType: "scheduleItem"[\s\S]{0,500}before:[\s\S]{0,500}after: contentFields/, "Une modification éditoriale doit conserver sa version précédente.");
assert.match(privateContentSeed, /\.\.\.contentFields,\s*updatedAt: FieldValue\.serverTimestamp\(\),\s*updatedBy: "system_seed"/, "Un contenu réellement modifié doit devenir visible dans la prochaine synchronisation.");
assert.match(seedContentFieldsMatch[1], /dateIso:/, "Chaque événement Firestore doit recevoir sa date ISO canonique.");
assert.match(privateContentSeed, /else \{\s*batch\.set\(ref, \{\s*\.\.\.contentFields,\s*status: "pending",\s*deleted: false,\s*selected: post\.choiceRequired !== true,\s*updatedAt: FieldValue\.serverTimestamp\(\),\s*updatedBy: "system_seed"/, "Les valeurs d’état initiales doivent être réservées aux nouveaux événements.");
for (const { file, source: mediaSeed } of mediaSeedSources) {
  const contentFieldsMatch = mediaSeed.match(/const contentFields = \{([\s\S]*?)\r?\n  \};/);
  assert.ok(contentFieldsMatch, `${file} doit isoler les métadonnées du média de son état collaboratif.`);
  for (const field of ["stage", "publicationBlocked", "archived", "authorUid", "authorLabel", "createdAt", "updatedAt", "updatedBy"]) {
    assert.doesNotMatch(contentFieldsMatch[1], new RegExp(`\\b${field}\\s*:`), `${file} ne doit pas réinitialiser ${field} sur un média existant.`);
  }
  assert.match(mediaSeed, /sameSeedFields\(existing\.data\(\),/, `${file} doit éviter toute écriture lorsque les métadonnées sont déjà identiques.`);
  assert.match(mediaSeed, /created \+ updated > 0/, `${file} ne doit pas valider un lot vide.`);
}
assert.match(natureMediaSeed, /stage: item\.stage \|\| "proposal"/,
  "Le seed nature doit reconstruire l’étape déclarée uniquement lors de la création d’un média.");
assert.match(natureMediaSeed, /publicationBlocked: item\.publicationBlocked === true/,
  "Le seed nature doit reconstruire le blocage éditorial d’une référence non diffusable.");
assert.match(natureMediaSeed, /archived: item\.archived === true/,
  "Le seed nature doit garder les anciennes variantes hors des propositions actives lors d’une reconstruction.");
const editorialMediaSeed = mediaSeedSources.find(({ file }) => file === "seed_editorial_media_links.js").source;
assert.match(editorialMediaSeed, /item\.reuseMediaId/,
  "Le seed éditorial doit pouvoir réutiliser explicitement un fichier SharePoint déjà hébergé.");
assert.match(editorialMediaSeed, /reusedUrls\.has\(item\.reuseMediaId\)/,
  "Les lectures de médias source réutilisés doivent être mises en cache dans le même lot.");
assert.match(editorialMediaSeed, /Documents%20partages/,
  "Le semeur éditorial doit accepter les liens directs authentifiés du SharePoint Bleu Massawippi.");
assert.match(privateContentSeed, /--ids=/,
  "La synchronisation du calendrier doit accepter une liste d’identifiants ciblée pour limiter les lectures Firestore.");
assert.match(privateContentSeed, /selectedPosts/,
  "La synchronisation ciblée doit limiter les documents de calendrier lus et écrits.");
assert.match(poetryReminderCliSync, /writes\.length > 30/,
  "La synchronisation REST des rappels doit conserver un plafond d’écritures explicite.");
assert.match(poetryReminderCliSync, /currentDocument: existing\?\.exists \? \{ updateTime: existing\.updateTime \} : \{ exists: false \}/,
  "Chaque écriture REST doit refuser d’écraser un document modifié depuis le dry-run.");
assert.match(poetryReminderCliSync, /completedOrPublishedMoved: false/,
  "La synchronisation REST ne doit jamais déplacer une publication programmée ou diffusée.");
assert.match(poetryReminderCliSync, /directionDecisionInvented: false/,
  "La synchronisation REST ne doit pas inventer une décision de la direction.");
const mainPostCount = posts.filter((post) => !post.isAlternative).length;
const postsPerDay = activePosts.reduce((counts, post) => counts.set(post.dateIso, (counts.get(post.dateIso) || 0) + 1), new Map());
const pairedDayCount = [...postsPerDay.values()].filter((count) => count > 1).length;
console.log(JSON.stringify({ passed: true, mainPosts: mainPostCount, totalPosts: posts.length, activePairedDays: pairedDayCount, bilingualPosts: posts.length, historicalPosts: 6, attachedHistoricalMedia: historicalMedia.length, naturePosters: natureMedia.length, editorialMedia: editorialMedia.length, opportunities: 8, internalProjectsSeeded: 18, internalProjectDocuments: internalProjectDocuments.documents.length, movedPost: moved.id, volunteerDate: volunteer.date, contractChecks: 551 }, null, 2));
