import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts, preparePlanScript } from "./plan-overrides.js";
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
  { s1d1b: "2026-07-13", s2d3: "2026-07-22", s2d6: "2026-07-26", s3d1b: "2026-07-27", "alt-20260804": "2026-08-04", "alt-20260810": "2026-08-10" },
  "Les archives éditoriales doivent conserver leur date d’origine pour rester modifiables sous les règles Firestore."
);
for (const post of activePosts.filter((post) => post.dateIso >= "2026-07-22")) {
  assert.ok(plannedMedia.some((media) => media.eventId === post.id), `La publication future ${post.id} doit avoir au moins une proposition média explicite, même si sa diffusion exige encore une validation.`);
}
assert.deepEqual(
  activePosts.map((post) => post.dateIso),
  [...activePosts].map((post) => post.dateIso).sort(),
  "Le calendrier doit rester trié chronologiquement après tous les déplacements."
);
for (const week of [1,2,3,4,5,6,7,8,9]) {
  const dates = [...new Set(activePosts.filter((post) => post.w === week).map((post) => post.dateIso))];
  assert.deepEqual(dates, [...dates].sort(), `La semaine ${week} doit suivre l’ordre réel des dates.`);
}
const continuityStart = new Date("2026-07-13T12:00:00Z");
const continuityEnd = new Date("2026-09-14T12:00:00Z");
const expectedContinuityDates = [];
for (const cursor = new Date(continuityStart); cursor <= continuityEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
  expectedContinuityDates.push(cursor.toISOString().slice(0, 10));
}
const activePostsByDate = Object.groupBy(activePosts, (post) => post.dateIso);
assert.deepEqual(Object.keys(activePostsByDate).sort(), expectedContinuityDates,
  "Le calendrier actif doit couvrir chaque journée du 13 juillet au 14 septembre sans trou après le report conservatoire du sujet scientifique.");
assert.ok(Object.values(activePostsByDate).every((items) => items.length === 1),
  "Chaque journée du calendrier continu doit afficher exactement une publication active.");
assert.equal(activePosts.length, 64, "Le calendrier continu doit contenir 64 publications actives, dont le sujet scientifique conservé au 14 septembre.");
const continuityPostIds = [
  "don-20260909-appel-soutien",
  "nature-20260910-feuille-surface",
  "don-20260911-merci-bilan",
  "archives-20260912-vos-images",
  "quiz-20260913-trois-gestes"
];
for (const id of continuityPostIds) {
  const post = activePosts.find((item) => item.id === id);
  assert.ok(post, `La publication de continuité ${id} doit exister.`);
  assert.match(post.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/,
    `La publication de continuité ${id} doit être bilingue.`);
  assert.ok(post.copy.length <= 2200, `La publication de continuité ${id} doit respecter la limite Meta.`);
  const media = editorialMedia.filter((item) => item.eventId === id && item.stage !== "archived" && item.archived !== true);
  assert.equal(media.length, 1, `La publication de continuité ${id} doit avoir un média actif clair.`);
  assert.ok(media[0].previewUrl, `Le média de ${id} doit afficher un vrai aperçu mobile.`);
  assert.ok(media[0].reuseMediaId, `Le média de ${id} doit réutiliser un fichier déjà hébergé sans copie inutile.`);
}
const septemberThankYou = activePosts.find((post) => post.id === "don-20260911-merci-bilan");
assert.equal(septemberThankYou.publicationBlocked, true, "Le bilan du 11 septembre doit rester bloqué tant que le montant n’est pas confirmé.");
assert.deepEqual(septemberThankYou.requiredPlaceholders, ["[MONTANT NET CONFIRMÉ]", "[CONFIRMED NET AMOUNT]"]);
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
assert.equal(volunteer.date, "Mardi 8 septembre");
assert.equal(volunteer.w, 9);
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
assert.equal(posts.filter((post) => !post.isAlternative).length, 39);
assert.equal(posts.length, 70);
const radioCanadaInterview = posts.find((post) => post.id === "actualite-20260808-denis-radio-canada-moules-zebrees");
assert.ok(radioCanadaInterview, "Le relais de l’entrevue de Denis à Radio-Canada doit être conservé dans le plan.");
assert.equal(radioCanadaInterview.dateIso, "2026-08-08");
assert.match(radioCanadaInterview.copy, /2442552\/entrevue/);
assert.match(radioCanadaInterview.copy, /^FR —[\s\S]*=========================================[\s\S]*EN —/);
assert.ok(!/«[^»]+»/.test(radioCanadaInterview.copy), "Aucune citation de Denis ne doit être inventée à partir du seul lien OHdio.");
const nonMotorizedWash = posts.find((post) => post.id === "lavage-20260903-sans-moteur");
assert.ok(nonMotorizedWash, "La recommandation du 23 juillet sur les embarcations non motorisées doit devenir une publication planifiée.");
assert.equal(nonMotorizedWash.dateIso, "2026-09-03");
assert.equal(nonMotorizedWash.choiceRequired, false);
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
assert.deepEqual(posts.filter((post) => post.dateIso === "2026-08-07").map((post) => post.id), [donationThanks.id], "Le 7 août doit être réservé au bilan Zeffy.");
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
assert.equal(displacedWatershedPost.dateIso, "2026-08-09");
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
assert.doesNotMatch(bullheadPost.copy, /cancer|maladie|lésion|tumeur|disease|lesion|tumou?r/i,
  "L’appel doit s’en tenir au signalement du poisson, sans angle sanitaire inventé.");
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
const cattailPost = posts.find((post) => post.id === "alt-20260729");
assert.match(cattailPost.copy, /présence et son contexte/i);
assert.match(cattailPost.copy, /observation ou d’un inventaire local documenté/i);
const visualPausePost = posts.find((post) => post.id === "s3d6");
assert.match(visualPausePost.format, /Photo plein cadre/i);
assert.match(visualPausePost.copy, /quel souvenir gardez-vous de votre Massawippi\?/i, "La question courte validée doit demeurer dans la respiration photo.");
assert.doesNotMatch(visualPausePost.copy, /commentaire/i, "La respiration photo ne doit pas demander explicitement un commentaire.");
const fiveHabitsPost = posts.find((post) => post.id === "s3d7");
assert.match(fiveHabitsPost.title, /Cinq réflexes/i);
assert.match(fiveHabitsPost.copy, /5 —/);
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
const firstFourWeeks = Object.groupBy(posts.filter((post) => post.w <= 4), (post) => post.date);
assert.equal(Object.keys(firstFourWeeks).length, 28);
assert.equal(Object.values(firstFourWeeks).filter((items) => items.length >= 2).length, 0,
  "Chaque date des quatre premières semaines doit désormais contenir une seule publication active.");
assert.ok(firstFourWeeks["Mercredi 22 juillet"].some((post) => post.id === donationAppeal.id));
assert.ok(firstFourWeeks["Vendredi 7 août"].some((post) => post.id === donationThanks.id));
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
assert.equal(deferredMonitoring.date, "Lundi 14 septembre");
assert.equal(deferredMonitoring.w, 10);
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
assert.equal(deferredMemories.date, "Samedi 29 août", "La capsule souvenirs doit rester conservée à une autre date.");
assert.equal(deferredShoreLife.date, "Samedi 22 août", "La biodiversité sous les feuilles doit rester conservée à une autre date.");
const frogSeries = posts.find((post) => post.id === "alt-20260802");
assert.match(frogSeries.title, /voix à documenter autour du bassin/i);
assert.match(frogSeries.copy, /ne constitue pas encore un inventaire complet du bassin|Ce n’est pas encore un inventaire complet du bassin/i);
assert.match(frogSeries.copy, /une espèce à la fois/i);
assert.match(frogSeries.visual, /Ne pas présenter l’affiche comme un inventaire local confirmé/i);
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
for (const mediaId of [
  "editorial-s1d4-mon-massawippi-fridge-v5",
  "editorial-alt-20260719-engraving-crop-upscale-v3",
  "editorial-s2d5-vitesse-rive-planche-simple-v4"
]) {
  const media = editorialMedia.find((item) => item.id === mediaId);
  assert.match(media?.previewUrl || "", /^https:\/\/vhaloo\.github\.io\/bleu-massawippi-cockpit\/media-previews\/.+\.webp$/);
  const previewPath = new URL(media.previewUrl).pathname.replace(/^\/bleu-massawippi-cockpit\//, "");
  assert.ok(fs.existsSync(path.join(here, previewPath)), `La vignette publique de ${mediaId} doit être incluse dans le site.`);
}
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

for (const token of ["SpeechRecognition", "webkitSpeechRecognition", "getUserMedia", "button[data-dictate]", "data-add-post-calendar", "data-media-form", "cockpit-media-open-label", "cockpit-media-info", "Informations et actions", "cockpit-media-enlarge", "object-fit: contain", "setupMediaNavigation", "data-media-previous", "data-media-next", "glissez les images ou utilisez les flèches", "cockpit-date-elevator", "data-date-target", "requestDateElevatorUpdate", "data-workflow-stage", "workflowDirection", "aria-pressed=\"false\"", "Feu vert retiré; l’historique est conservé.", "id=\"cockpit-task-count\" data-task-count", "Mini-chat de l’événement", "data-resolve-comment", "Voir les messages traités", "comment-task", "data-editorial-decision", "Bonne idée — autre jour", "Ne pas retenir cet angle", "editorial-deferred", "data-comment-thread", "MutationObserver", "Connexion…", "bleu-massawippi-guide-collapsed", "data-guide-new-badge", "setOpportunityStage", "data-opportunity-stage", "bleu-massawippi-projects-collapsed", "setupInternalProjectPreference", "setupInternalProjectEvents", "renderInternalProjectStates", "data-internal-project-stage", "internalProjectUnsubscribe", "Valider le texte avec l’aval", "Le texte et le visuel peuvent avancer en parallèle", "syncResponsiveOffsets", "setAdminSidebarOpen", "--cockpit-session-height"]) {
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
assert.match(source, /IQBEpphVNmkmRai8MXNpQKldATppGkCRq0xdZBV28w5LXas/);
assert.match(source, /Ouvrir le document/);
assert.match(source, /Télécharger le PDF/);
const mainNav = source.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] || "";
assert.match(mainNav, /<a href="#context-collapsible">Stratégie<\/a>/,
  "Le sommaire doit regrouper le contexte éditorial sous une seule entrée Stratégie.");
assert.doesNotMatch(mainNav, />Lire-moi<\/a>|>Collaboration<\/a>|>Cap<\/a>|>Cadence<\/a>|>Validation<\/a>|Participation photo/,
  "Le sommaire ne doit plus répéter les sous-sections du contexte stratégique ni isoler la participation photo.");
const strategyToc = source.match(/<nav class="strategy-toc"[\s\S]*?<\/nav>/)?.[0] || "";
for (const target of ["readme-collapsible", "strategic-document-plan", "collaboration", "governance-sharepoint-ca", "cap", "cadence", "validation"]) {
  assert.match(strategyToc, new RegExp(`href="#${target}"`), `Le sommaire stratégique doit relier la section ${target}.`);
}
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
assert.equal((source.match(/data-internal-project-id=/g) || []).length, 15, "Le registre privé doit contenir les quinze projets internes documentés.");
assert.match(source, /data-internal-project-register[^>]*data-layout-version="2026-07-23-lamproie-2027-v1"/);
const internalProjectIds = [...source.matchAll(/data-internal-project-id="([a-z0-9-]+)"/g)].map((match) => match[1]).sort();
const internalProjectSeedIds = [...internalProjectSeed.matchAll(/^  "([a-z0-9-]+)": "(?:to_frame|planned|active|blocked|completed)"[,]?$/gm)].map((match) => match[1]).sort();
assert.deepEqual(internalProjectSeedIds, internalProjectIds, "Les cartes et le seed des projets internes doivent utiliser exactement les mêmes identifiants.");
assert.match(source, /data-internal-project-id="jeux-provinciaux-peche" data-initial-stage="completed"/,
  "Les Jeux provinciaux de pêche doivent rester classés comme projet terminé dans la source.");
assert.match(source, /Jeux provinciaux de pêche — événement terminé[\s\S]{0,180}Terminé · archivé/,
  "La fiche des Jeux provinciaux de pêche doit annoncer clairement sa clôture.");
assert.match(internalProjectSeed, /"jeux-provinciaux-peche": "completed"/,
  "Le seed ne doit jamais recréer les Jeux provinciaux de pêche comme projet actif ou bloqué.");
const applicationProject = source.match(/<details class="internal-project urgent" id="internal-project-application-carte-vivante-lac"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
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
const poetryProject = source.match(/<details class="internal-project" id="internal-project-poesie-du-lac"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(poetryProject, /réseau d’acteurs, de poètes, de slameurs et d’interprètes/,
  "Le réseau professionnel mobilisable doit être décrit sans réduire le projet à un appel public.");
assert.match(poetryProject, /Au bord du bleu/);
assert.match(poetryProject, /dimanche 30 août/i);
assert.match(poetryProject, /13 h à 16 h/i);
assert.match(poetryProject, /programme public d’environ une à deux heures/i);
assert.match(poetryProject, /Passages de 5 à 15 minutes/);
assert.match(poetryProject, /partie engazonnée du parc Lôbadanaki/i);
assert.match(poetryProject, /distincte de la bande riveraine fermée/i);
assert.match(poetryProject, /Cible : 0 \$/);
assert.match(poetryProject, /Plafond prudent : 250 \$ maximum/);
assert.match(poetryProject, /Direction générale — environ 1 h 10 au total/);
assert.match(poetryProject, /Communications — environ 8 à 12 h au total/);
assert.match(poetryProject, /internal-project-poster-featured/);
assert.doesNotMatch(poetryProject, /internal-project-poster-pair/,
  "Le projet ne doit plus afficher deux affiches concurrentes.");
assert.match(source, /\.internal-project-poster-featured \{ grid-template-columns:minmax\(260px,440px\) minmax\(0,1fr\)/,
  "L’affiche unique doit disposer d’un espace lisible sur ordinateur.");
assert.match(poetryProject, /affiche-au-bord-du-bleu-photo-reelle-v7-bilingue-apercu\.webp/);
assert.match(poetryProject, /affiche-au-bord-du-bleu-photo-reelle-v7-bilingue\.png/);
assert.match(poetryProject, /Affiche bilingue — photo réelle V7/);
assert.match(poetryProject, /v7-bilingue-apercu\.webp[^>]+loading="eager"[^>]+fetchpriority="high"/,
  "L’unique aperçu bilingue doit être chargé immédiatement.");
assert.doesNotMatch(poetryProject, /v6-fr|v6-en|Affiche française|English poster/,
  "Les affiches V6 doivent être conservées dans les fichiers sans rester visibles dans le cockpit.");
assert.match(poetryProject, /Partenaires et commandites — visibilité utile, indépendance préservée/);
assert.match(poetryProject, /aucune visibilité ne donne un droit de regard sur la sélection artistique/i);
assert.match(poetryProject, /ADDENDUM_VISUEL_PARTENAIRES_AU_BORD_DU_BLEU_V5\.md/);
assert.match(poetryProject, /data-initial-stage="active" open/,
  "La fiche poésie en préparation avancée doit rester ouverte afin de rendre l’affiche immédiatement visible.");
assert.match(poetryProject, /30 AOÛT · 13 H–16 H · PARC LÔBADANAKI PRÉVU/);
assert.match(poetryProject, /Feu vert acquis et premier appui concret/i);
assert.match(poetryProject, /poesie-rencontre-north-hatley-2026-08-10/);
assert.match(poetryProject, /Le 10 août, la direction rencontre la direction générale de North Hatley/,
  "La date et l’interlocutrice de la rencontre doivent être visibles dans la prochaine action.");
for (const meetingTopic of ["Lieu et autorité", "Horaire et logistique", "Météo et décision", "Collaboration et visibilité"]) {
  assert.match(meetingBriefBuilder, new RegExp(meetingTopic), `Le PDF municipal doit couvrir : ${meetingTopic}.`);
}
assert.doesNotMatch(poetryProject, /<details[^>]+id="poesie-rencontre-north-hatley-2026-08-10"/,
  "L’aide-mémoire ne doit plus occuper un long encart dans la fiche du projet.");
assert.match(poetryProject, /Aide_memoire_rencontre_North_Hatley_Au_bord_du_bleu_2026-08-10\.pdf/);
assert.match(poetryProject, /Aide-mémoire — rencontre du 10 août/);
assert.equal((poetryProject.match(/class="internal-project-document-card"/g) || []).length, 10,
  "Les dix ressources du projet poésie doivent être présentées sous forme de cartes homogènes.");
assert.equal((poetryProject.match(/class="internal-project-document-kind"/g) || []).length, 10,
  "Chaque carte documentaire doit annoncer clairement son type.");
assert.equal((poetryProject.match(/class="internal-project-document-action"/g) || []).length, 9,
  "Chaque ressource spécialisée doit proposer un bouton d’ouverture explicite.");
const meetingBriefPdf = path.join(root, "cockpit", "project-documents", "Aide_memoire_rencontre_North_Hatley_Au_bord_du_bleu_2026-08-10.pdf");
assert.ok(fs.existsSync(meetingBriefPdf), "Le PDF d’aide-mémoire doit être publié avec le cockpit.");
assert.ok(fs.statSync(meetingBriefPdf).size > 50_000, "Le PDF d’aide-mémoire doit contenir sa mise en page et le logo.");
assert.match(poetryProject, /https:\/\/forms\.office\.com\/r\/4A2xsMh7st/);
assert.match(poetryProject, /Candidatures reçues/);
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
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v6-fr-apercu.webp",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v6-fr.png",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v6-en-apercu.webp",
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v6-en.png",
  "cockpit/assets/projects/poesie-du-lac/poesie-au-bord-du-bleu-lac-massawippi-photo-dji-0100-preview.webp"
]) assert.ok(fs.existsSync(path.join(root, asset)), `Le livrable poésie doit exister : ${asset}`);
for (const preview of [
  "cockpit/assets/projects/poesie-du-lac/affiche-au-bord-du-bleu-photo-reelle-v7-bilingue-apercu.webp"
]) assert.ok(fs.statSync(path.join(root, preview)).size < 180_000,
  `L’aperçu bilingue unique du projet poésie doit rester léger sur mobile : ${preview}`);
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
const pagesWorkflow = fs.readFileSync(path.join(root, ".github/workflows/deploy-pages.yml"), "utf8");
assert.match(pagesWorkflow, /cp -R cockpit\/assets public\/assets/,
  "GitHub Pages doit publier les visuels des projets internes.");
for (const stage of ["to_frame", "planned", "active", "blocked", "completed"]) {
  assert.ok(client.includes(`"${stage}"`) && firestoreRules.includes(`'${stage}'`) && internalProjectSeed.includes(`"${stage}"`), `L’étape interne ${stage} doit rester alignée entre client, règles et initialisation.`);
}
assert.equal((internalProjectSeed.match(/^  "[a-z0-9-]+": "(?:to_frame|planned|active|blocked|completed)"[,]?$/gm) || []).length, 15, "Le seed initial doit couvrir les quinze projets internes documentés.");
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
const mainPostCount = posts.filter((post) => !post.isAlternative).length;
const postsPerDay = activePosts.reduce((counts, post) => counts.set(post.dateIso, (counts.get(post.dateIso) || 0) + 1), new Map());
const pairedDayCount = [...postsPerDay.values()].filter((count) => count > 1).length;
console.log(JSON.stringify({ passed: true, mainPosts: mainPostCount, totalPosts: posts.length, activePairedDays: pairedDayCount, bilingualPosts: posts.length, historicalPosts: 6, attachedHistoricalMedia: historicalMedia.length, naturePosters: natureMedia.length, editorialMedia: editorialMedia.length, opportunities: 8, internalProjectsSeeded: 15, internalProjectDocuments: internalProjectDocuments.documents.length, movedPost: moved.id, volunteerDate: volunteer.date, contractChecks: 540 }, null, 2));
