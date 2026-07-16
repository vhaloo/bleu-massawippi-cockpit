import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts, preparePlanScript } from "./plan-overrides.js";
import { BILINGUAL_POLICY_VERSION, FUTURE_EDITORIAL_IDS, TONE_VERSION } from "./editorial-copy-overrides.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ui = fs.readFileSync(path.join(here, "cockpit-ui.js"), "utf8");
const taskProgressUi = fs.readFileSync(path.join(here, "task-progress-ui.js"), "utf8");
const viewMode = fs.readFileSync(path.join(here, "view-mode.js"), "utf8");
const viewFixture = fs.readFileSync(path.join(here, "test-fixtures", "view-mode.html"), "utf8");
const client = fs.readFileSync(path.join(here, "firebase-client.js"), "utf8");
const theme = fs.readFileSync(path.join(here, "theme.js"), "utf8");
const firebaseConfig = fs.readFileSync(path.join(here, "firebase-config.js"), "utf8");
const firestoreRules = fs.readFileSync(path.join(here, "firestore.rules"), "utf8");
const privateContentSeed = fs.readFileSync(path.join(here, "seed_private_content.js"), "utf8");
const internalProjectSeed = fs.readFileSync(path.join(here, "seed_internal_project_states.js"), "utf8");
const adminSync = fs.readFileSync(path.join(here, "admin_sync.js"), "utf8");
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
const posts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const activePosts = posts.filter((post) => post.archivedEditorial !== true);
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
  { s2d3: "2026-07-22", s2d6: "2026-07-26", s3d1b: "2026-07-27" },
  "Les archives éditoriales doivent conserver leur date d’origine pour rester modifiables sous les règles Firestore."
);
assert.deepEqual(
  activePosts.map((post) => post.dateIso),
  [...activePosts].map((post) => post.dateIso).sort(),
  "Le calendrier doit rester trié chronologiquement après tous les déplacements."
);
for (const week of [1,2,3,4,5,6,7,8]) {
  const dates = [...new Set(activePosts.filter((post) => post.w === week).map((post) => post.dateIso))];
  assert.deepEqual(dates, [...dates].sort(), `La semaine ${week} doit suivre l’ordre réel des dates.`);
}
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
assert.equal(moved.date, "Lundi 10 août");
assert.equal(moved.w, 5);
assert.equal(volunteer.date, "Mardi 11 août");
assert.equal(volunteer.w, 5);
assert.equal(volunteer.coordinationLevel, "high");
assert.ok(volunteer.tasksValentin.length >= 5);
assert.ok(volunteer.tasksAnnie.length >= 4);
assert.equal(firstTuesday.choiceRequired, false, "La proposition retenue du mardi est verrouillée et ne demande plus d’arbitrage.");
assert.equal(firstTuesday.optionGroup, null, "Une proposition verrouillée ne doit plus appartenir à un groupe de choix actif.");
assert.equal(posts.filter((post) => !post.isAlternative).length, 28);
assert.equal(posts.length, 58);
const samplingPost = posts.find((post) => post.id === "s3d5");
assert.match(samplingPost.title, /prélèvement/i, "Le retour sur les résultats doit devenir une explication concrète du prélèvement.");
assert.match(samplingPost.copy, /lac, tributaire ou plage/i);
assert.match(samplingPost.copy, /seulement après (leur )?validation/i);
const cattailPost = posts.find((post) => post.id === "alt-20260729");
assert.match(cattailPost.copy, /présence et son contexte/i);
assert.match(cattailPost.copy, /observation ou d’un inventaire local documenté/i);
const visualPausePost = posts.find((post) => post.id === "s3d6");
assert.match(visualPausePost.format, /Photo plein cadre/i);
assert.doesNotMatch(visualPausePost.copy, /\?|commentaire/i, "La respiration photo ne doit pas solliciter une réponse.");
const fiveHabitsPost = posts.find((post) => post.id === "s3d7");
assert.match(fiveHabitsPost.title, /Cinq réflexes/i);
assert.match(fiveHabitsPost.copy, /5 —/);
const boardPortrait = posts.find((post) => post.id === "s1d3");
assert.match(boardPortrait.title, /Pourquoi nous nous impliquons/i);
assert.ok(boardPortrait.tasksAnnie.length >= 4);
const lexiconPost = posts.find((post) => post.id === "lexique-20260830-tributaire");
assert.match(lexiconPost.copy, /cours d’eau qui en rejoint un autre/i);
const firstFourWeeks = Object.groupBy(posts.filter((post) => post.w <= 4), (post) => post.date);
assert.equal(Object.keys(firstFourWeeks).length, 28);
assert.equal(Object.values(firstFourWeeks).filter((items) => items.length >= 2).length, 8);
const deferredBoatWash = posts.find((post) => post.id === "s4d1");
assert.equal(deferredBoatWash.date, "Vendredi 21 août");
assert.equal(deferredBoatWash.w, 6);
assert.match(deferredBoatWash.title, /rituel complet/i);
assert.match(deferredBoatWash.copy, /retirer les débris visibles, vider l’eau retenue, nettoyer/i);
assert.doesNotMatch(deferredBoatWash.source, /ccq\.org/i);
const soloAugustThird = posts.find((post) => post.id === "s4d1b");
assert.equal(soloAugustThird.choiceRequired, false, "La seule carte du 3 août ne doit pas afficher un faux choix.");
assert.equal(soloAugustThird.optionGroup, null);
const sundayHeritage = posts.find((post) => post.id === "alt-20260719");
assert.equal(sundayHeritage.date, "Dimanche 19 juillet");
assert.equal(sundayHeritage.w, 1);
assert.match(sundayHeritage.title, /Massawippi vu en 1859/i);
const deferredMonitoring = posts.find((post) => post.id === "s1d2");
assert.equal(deferredMonitoring.date, "Jeudi 13 août");
assert.equal(deferredMonitoring.w, 5);
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
assert.match(deferredBlueMinute.copy, /#InstantBleu/);
assert.doesNotMatch(`${deferredBlueMinute.title}\n${deferredBlueMinute.visual}\n${deferredBlueMinute.copy}`, /Juste une minute|Une minute bleue|#MinuteBleue/i);
assert.doesNotMatch(saturdayCommunity.copy, /Nous avons envie de découvrir ce qui fait vivre votre lien/i);
assert.equal(deferredMemories.date, "Jeudi 20 août", "La capsule souvenirs doit rester conservée à une autre date.");
assert.equal(deferredShoreLife.date, "Samedi 22 août", "La biodiversité sous les feuilles doit rester conservée à une autre date.");
const frogSeries = posts.find((post) => post.id === "alt-20260802");
assert.match(frogSeries.title, /voix à documenter autour du bassin/i);
assert.match(frogSeries.copy, /ne constitue pas encore un inventaire complet du bassin|Ce n’est pas encore un inventaire complet du bassin/i);
assert.match(frogSeries.copy, /une espèce à la fois/i);
assert.match(frogSeries.visual, /Ne pas présenter l’affiche comme un inventaire local confirmé/i);
const decidedFirstTwoWeeks = Object.groupBy(posts.filter((post) => post.w <= 2), (post) => post.date);
assert.equal(Object.keys(decidedFirstTwoWeeks).length, 14, "Les deux semaines arbitrées doivent conserver une publication par jour.");
assert.ok(Object.values(decidedFirstTwoWeeks).every((items) => items.length === 1), "Chaque journée déjà arbitrée doit afficher une seule publication retenue.");
assert.equal(posts.filter((post) => post.t === "Nature").length, 9);
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
assert.match(preparedPlanScript, /\[1,2,3,4,5,6,7,8\]\.forEach/);
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
assert.match(ui, /while \(node\)[\s\S]{0,100}node\.matches\?\.\("details"\)/, "La navigation doit ouvrir tous les volets ancêtres.");
assert.match(ui, /\[data-cockpit-private-root\] section\[id\]/, "Les boîtes d’avis doivent survivre au retrait du main imbriqué.");
assert.match(ui, /grid-template-columns:46px minmax\(0,1fr\)/, "Le bouton Enregistrer du mini-chat doit rester lisible sur mobile.");
assert.match(viewMode, /\(\?:er\)\?\\s\+\(janvier/);
assert.match(viewMode, /plain\.match\(\/\^\(\\d\{4\}\)\-\(\\d\{2\}\)\-\(\\d\{2\}\)\$\//, "La vue essentielle doit reconnaître les dates ISO canoniques.");
assert.match(viewMode, /date\.getFullYear\(\) === year[\s\S]{0,120}date\.getDate\(\) === day/, "Une date ISO invalide ne doit pas être normalisée silencieusement.");
assert.match(viewMode, /item\.dateIso \|\| item\.date/, "La vue essentielle doit utiliser la date ISO canonique.");
assert.match(viewMode, /distance > 0 && distance <= 7/, "Le panneau des sept prochains jours ne doit pas répéter Aujourd’hui.");
for (const token of ["calendarTime", "calendarDurationMinutes", "calendarLocation", "calendarCost", "postCalendarMetadata"]) {
  assert.ok(ui.includes(token), `Le fichier calendrier doit utiliser ${token}.`);
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
assert.equal(historicalMedia.filter((item) => /confirmer/i.test(item.license || "")).length, 3);
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
assert.equal(new Set(natureMedia.map((item) => item.eventId)).size, 10);
for (const media of natureMedia) {
  const relatedPost = posts.find((post) => post.id === media.eventId);
  assert.ok(relatedPost, `L’affiche ${media.fileName} doit être reliée à une publication existante.`);
  assert.ok(relatedPost.t === "Nature" || media.eventId === "lexique-20260830-tributaire", `L’affiche ${media.fileName} doit servir une publication nature ou la capsule lexique documentée.`);
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

for (const token of ["SpeechRecognition", "webkitSpeechRecognition", "getUserMedia", "button[data-dictate]", "data-add-post-calendar", "data-media-form", "cockpit-media-open-label", "cockpit-media-info", "Informations et actions", "cockpit-media-enlarge", "object-fit: contain", "setupMediaNavigation", "data-media-previous", "data-media-next", "glissez les images ou utilisez les flèches", "cockpit-date-elevator", "data-date-target", "requestDateElevatorUpdate", "data-workflow-stage", "workflowDirection", "aria-pressed=\"false\"", "Feu vert retiré; l’historique est conservé.", "id=\\\"cockpit-task-count\\\" data-task-count", "Mini-chat de l’événement", "data-resolve-comment", "Voir les messages traités", "comment-task", "data-editorial-decision", "Bonne idée — autre jour", "Ne pas retenir cet angle", "editorial-deferred", "data-comment-thread", "MutationObserver", "Connexion…", "bleu-massawippi-guide-collapsed", "data-guide-new-badge", "setOpportunityStage", "data-opportunity-stage", "bleu-massawippi-projects-collapsed", "setupInternalProjectPreference", "setupInternalProjectEvents", "renderInternalProjectStates", "data-internal-project-stage", "internalProjectUnsubscribe", "Valider le texte avec l’aval", "Le texte et le visuel peuvent avancer en parallèle", "syncResponsiveOffsets", "setAdminSidebarOpen", "--cockpit-session-height"]) {
  assert.ok(ui.includes(token), `Le cockpit doit contenir le contrat ${token}.`);
}
for (const token of ["stateTimestampMillis", "actionTaskPriority", "data-task-target-type", "data-task-updated-at", "cockpit-task-priority", "data-media-updated-at", "dataset.workflowUpdatedAt", "dataset.editorialUpdatedAt", "cockpit-media-blocked", "Référence non diffusable"]) {
  assert.ok(`${ui}\n${taskProgressUi}`.includes(token), `La file priorisée doit exposer le contrat ${token}.`);
}
for (const token of ["roleDecisionForEvent", "roleDecisionModels", "pendingTaskModels", "mediaUpdatedAfterWorkflow", "Pourquoi maintenant", "left.urgency.rank", "Nouvelle consigne de la direction", "Texte prêt pour votre validation"]) {
  assert.ok(viewMode.includes(token), `La vue essentielle doit prioriser les décisions avec ${token}.`);
}
assert.match(viewMode, /if \(role === "admin" && latestTask && !event\.complete\)/,
  "Une tâche transmise par la direction doit apparaître seulement dans la file des communications et ne jamais ressusciter une publication terminée.");
assert.match(viewMode, /if \(role === "director"\)[\s\S]{0,1800}if \(role === "admin"\)/,
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
assert.equal((source.match(/data-internal-project-id=/g) || []).length, 13, "Le registre privé doit contenir les treize projets internes documentés.");
assert.match(source, /data-internal-project-register[^>]*data-layout-version="2026-07-16-poesie-du-lac-v2"/);
const internalProjectIds = [...source.matchAll(/data-internal-project-id="([a-z0-9-]+)"/g)].map((match) => match[1]).sort();
const internalProjectSeedIds = [...internalProjectSeed.matchAll(/^  "([a-z0-9-]+)": "(?:to_frame|planned|active|blocked|completed)"[,]?$/gm)].map((match) => match[1]).sort();
assert.deepEqual(internalProjectSeedIds, internalProjectIds, "Les cartes et le seed des projets internes doivent utiliser exactement les mêmes identifiants.");
assert.match(source, /data-internal-project-id="jeux-provinciaux-peche" data-initial-stage="completed"/,
  "Les Jeux provinciaux de pêche doivent rester classés comme projet terminé dans la source.");
assert.match(source, /Jeux provinciaux de pêche — événement terminé[\s\S]{0,180}Terminé · archivé/,
  "La fiche des Jeux provinciaux de pêche doit annoncer clairement sa clôture.");
assert.match(internalProjectSeed, /"jeux-provinciaux-peche": "completed"/,
  "Le seed ne doit jamais recréer les Jeux provinciaux de pêche comme projet actif ou bloqué.");
const poetryProject = source.match(/<details class="internal-project" id="internal-project-poesie-du-lac"[\s\S]*?<div data-internal-project-controls><\/div>[\s\S]*?<\/details>/)?.[0] || "";
assert.match(poetryProject, /Valentin Wittwe, directeur des communications de Bleu Massawippi/,
  "La fiche poésie doit expliciter l’actif relationnel demandé par les communications.");
assert.match(poetryProject, /réseau d’acteurs, de poètes, de slameurs et d’interprètes/,
  "Le réseau professionnel mobilisable doit être décrit sans réduire le projet à un appel public.");
assert.match(poetryProject, /75 à 105 minutes/);
assert.match(poetryProject, /6 à 10 artistes/);
assert.match(poetryProject, /Direction générale — environ 1 h 15 au total/);
assert.match(poetryProject, /Communications — environ 8 à 12 h au total/);
assert.match(poetryProject, /affiche-poesie-au-bord-du-lac-concept-v1\.webp/);
assert.match(poetryProject, /affiche-poesie-au-bord-du-lac-concept-v1\.png/);
for (const asset of [
  "cockpit/assets/projects/poesie-du-lac/affiche-poesie-au-bord-du-lac-concept-v1.webp",
  "cockpit/assets/projects/poesie-du-lac/affiche-poesie-au-bord-du-lac-concept-v1.png",
  "Projets internes/Poésie au bord du lac/DOSSIER_OPERATIONNEL_POESIE_AU_BORD_DU_LAC_V2.md"
]) assert.ok(fs.existsSync(path.join(root, asset)), `Le livrable poésie doit exister : ${asset}`);
assert.ok(fs.statSync(path.join(root, "cockpit/assets/projects/poesie-du-lac/affiche-poesie-au-bord-du-lac-concept-v1.webp")).size < 150_000,
  "L’aperçu WebP du projet poésie doit rester léger sur mobile.");
for (const stage of ["to_frame", "planned", "active", "blocked", "completed"]) {
  assert.ok(client.includes(`"${stage}"`) && firestoreRules.includes(`'${stage}'`) && internalProjectSeed.includes(`"${stage}"`), `L’étape interne ${stage} doit rester alignée entre client, règles et initialisation.`);
}
assert.equal((internalProjectSeed.match(/^  "[a-z0-9-]+": "(?:to_frame|planned|active|blocked|completed)"[,]?$/gm) || []).length, 13, "Le seed initial doit couvrir les treize projets internes documentés.");
assert.equal(internalProjectDocuments.documents.length, 13, "Chaque projet interne doit avoir un dossier de proposition assaini.");
assert.equal(new Set(internalProjectDocuments.documents.map((item) => item.id)).size, 13, "Chaque dossier partageable doit viser un projet distinct.");
assert.equal(internalProjectDocuments.redaction, "Valentin Wittwe, directeur des communications, Bleu Massawippi");
for (const document of internalProjectDocuments.documents) {
  assert.ok(internalProjectIds.includes(document.id), `Le dossier ${document.id} doit correspondre à une fiche du cockpit.`);
  assert.match(document.file, /^Proposition_assainie_.+\.pdf$/);
  assert.match(document.url, /^(?:https:\/\/bleumassawippi\.sharepoint\.com\/:b:\/g\/|\.\/project-documents\/)/);
  assert.ok(ui.includes(document.url), `Le dossier ${document.id} doit être raccordé à son bouton dans l’interface.`);
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
console.log(JSON.stringify({ passed: true, mainPosts: 28, totalPosts: posts.length, pairedDays: 8, bilingualPosts: posts.length, historicalPosts: 6, attachedHistoricalMedia: historicalMedia.length, naturePosters: natureMedia.length, editorialMedia: editorialMedia.length, opportunities: 8, internalProjectsSeeded: 13, internalProjectDocuments: internalProjectDocuments.documents.length, movedPost: moved.id, volunteerDate: volunteer.date, contractChecks: 466 }, null, 2));
