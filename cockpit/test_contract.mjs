import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts, preparePlanScript } from "./plan-overrides.js";
import { FUTURE_EDITORIAL_IDS, TONE_VERSION } from "./editorial-copy-overrides.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ui = fs.readFileSync(path.join(here, "cockpit-ui.js"), "utf8");
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
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
const historicalMedia = JSON.parse(fs.readFileSync(path.join(here, "historical_media_manifest.json"), "utf8"));
const natureMedia = JSON.parse(fs.readFileSync(path.join(here, "nature_media_manifest.json"), "utf8"));
const editorialMedia = JSON.parse(fs.readFileSync(path.join(here, "editorial_media_manifest.json"), "utf8"));
const internalProjectDocuments = JSON.parse(fs.readFileSync(path.join(here, "internal_project_documents.json"), "utf8"));
const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
assert.ok(postsJson, "Le tableau des publications source doit rester lisible.");
const posts = applyPlanOverridesToPosts(JSON.parse(postsJson));
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
}
for (const historicalId of ["alt-20260719", "alt-20260726", "alt-20260801", "alt-20260804", "alt-20260807", "alt-20260810"]) {
  const historicalPost = posts.find((post) => post.id === historicalId);
  assert.ok(historicalPost, `La capsule historique ${historicalId} doit rester au calendrier.`);
  assert.match(historicalPost.source, /Domaine public/i);
  assert.equal(historicalPost.t, "Patrimoine");
}
assert.match(preparePlanScript(source.match(/<script>\s*(var posts=[\s\S]*?)<\/script>/i)[1], posts), /\[1,2,3,4,5,6,7,8\]\.forEach/);
assert.match(source, /planMonthIndex=\{janvier:0,[\s\S]*septembre:8/,
  "Le calendrier doit archiver correctement les publications de tous les mois, y compris septembre.");
assert.match(source, /new Date\(2026,month,Number\(m\[1\]\),23,59,59,999\)/,
  "Une publication doit rester visible jusqu’à la fin de sa journée locale.");
assert.ok(ui.includes("function isPlanItemPast"), "L’aperçu éditorial doit reconnaître les jours passés.");
assert.match(ui, /schedule\?\.status !== "deleted"[\s\S]{0,100}!isPlanItemPast\(item\)/,
  "L’aperçu éditorial doit masquer les jours passés par défaut.");
assert.match(source, /Coordination renforcée avant publication/);
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
assert.equal(natureMedia.length, 22);
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
assert.equal(editorialMedia.length, 28);
assert.equal(new Set(editorialMedia.map((item) => item.id)).size, editorialMedia.length);
for (const media of editorialMedia) {
  assert.ok(posts.some((post) => post.id === media.eventId), `Le visuel ${media.fileName} doit être relié à une publication existante.`);
  assert.match(media.fileName, /\.(?:jpg|mp4)$/);
  assert.ok(media.altText.length >= 60, `Le visuel ${media.fileName} doit conserver un texte alternatif utile.`);
}
const correctedDragonfly = natureMedia.find((item) => item.id === "nature-alt-20260715-libellule-manuscript-v3");
assert.ok(correctedDragonfly, "La libellule anatomiquement corrigée doit être proposée.");
assert.match(correctedDragonfly.altText, /exactement quatre ailes et six pattes/i);
assert.equal(editorialMedia.filter((item) => /\.jpg$/.test(item.fileName)).length, 26);
assert.equal(editorialMedia.filter((item) => /\.mp4$/.test(item.fileName) && item.kind === "video").length, 2);
assert.doesNotMatch(JSON.stringify(editorialMedia), /sharepoint\.com|:\/g\/IQ/i);

for (const token of ["SpeechRecognition", "webkitSpeechRecognition", "getUserMedia", "button[data-dictate]", "data-add-post-calendar", "data-media-form", "cockpit-media-open-label", "cockpit-media-info", "Informations et actions", "cockpit-media-enlarge", "object-fit: contain", "setupMediaNavigation", "data-media-previous", "data-media-next", "glissez les images ou utilisez les flèches", "cockpit-date-elevator", "data-date-target", "requestDateElevatorUpdate", "data-workflow-stage", "workflowDirection", "aria-pressed=\"false\"", "Feu vert retiré; l’historique est conservé.", "id=\\\"cockpit-task-count\\\" data-task-count", "Mini-chat de l’événement", "data-resolve-comment", "Voir les messages traités", "comment-task", "data-editorial-decision", "Bonne idée — autre jour", "Ne pas retenir cet angle", "editorial-deferred", "data-comment-thread", "MutationObserver", "Connexion…", "bleu-massawippi-guide-collapsed", "data-guide-new-badge", "setOpportunityStage", "data-opportunity-stage", "bleu-massawippi-projects-collapsed", "setupInternalProjectPreference", "setupInternalProjectEvents", "renderInternalProjectStates", "data-internal-project-stage", "internalProjectUnsubscribe", "Valider le texte avec l’aval", "Valider le visuel avec l’aval", "syncResponsiveOffsets", "setAdminSidebarOpen", "--cockpit-session-height"]) {
  assert.ok(ui.includes(token), `Le cockpit doit contenir le contrat ${token}.`);
}
for (const token of ["data-opportunity-note-box", "data-save-opportunity-comment", "comment-opportunity-", "Notes partagées sur cette occasion", "renderOpportunityNotes"]) {
  assert.ok(ui.includes(token), `Le suivi individualisé des occasions doit contenir le contrat ${token}.`);
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
assert.equal((source.match(/data-internal-project-id=/g) || []).length, 12, "Le registre privé doit contenir les douze projets internes documentés.");
assert.match(source, /data-internal-project-register[^>]*data-layout-version="2026-07-13-internal-projects-v3"/);
const internalProjectIds = [...source.matchAll(/data-internal-project-id="([a-z0-9-]+)"/g)].map((match) => match[1]).sort();
const internalProjectSeedIds = [...internalProjectSeed.matchAll(/^  "([a-z0-9-]+)": "(?:to_frame|planned|active|blocked|completed)"[,]?$/gm)].map((match) => match[1]).sort();
assert.deepEqual(internalProjectSeedIds, internalProjectIds, "Les cartes et le seed des projets internes doivent utiliser exactement les mêmes identifiants.");
for (const stage of ["to_frame", "planned", "active", "blocked", "completed"]) {
  assert.ok(client.includes(`"${stage}"`) && firestoreRules.includes(`'${stage}'`) && internalProjectSeed.includes(`"${stage}"`), `L’étape interne ${stage} doit rester alignée entre client, règles et initialisation.`);
}
assert.equal((internalProjectSeed.match(/^  "[a-z0-9-]+": "(?:to_frame|planned|active|blocked|completed)"[,]?$/gm) || []).length, 12, "Le seed initial doit couvrir les douze projets internes documentés.");
assert.equal(internalProjectDocuments.documents.length, 12, "Chaque projet interne doit avoir un dossier de proposition assaini.");
assert.equal(new Set(internalProjectDocuments.documents.map((item) => item.id)).size, 12, "Chaque dossier partageable doit viser un projet distinct.");
assert.equal(internalProjectDocuments.redaction, "Valentin Wittwe, directeur des communications, Bleu Massawippi");
for (const document of internalProjectDocuments.documents) {
  assert.ok(internalProjectIds.includes(document.id), `Le dossier ${document.id} doit correspondre à une fiche du cockpit.`);
  assert.match(document.file, /^Proposition_assainie_.+\.pdf$/);
  assert.match(document.url, /^https:\/\/bleumassawippi\.sharepoint\.com\/:b:\/g\//);
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
assert.match(privateContentSeed, /if \(existing\.exists\) \{\s*batch\.set\(ref, contentFields, \{ merge: true \}\);\s*updatedStates \+= 1;/, "Un événement existant ne doit recevoir que les champs de contenu.");
assert.match(privateContentSeed, /else \{\s*batch\.set\(ref, \{\s*\.\.\.contentFields,\s*status: "pending",\s*deleted: false,\s*selected: post\.choiceRequired !== true,\s*updatedAt: FieldValue\.serverTimestamp\(\),\s*updatedBy: "system_seed"/, "Les valeurs d’état initiales doivent être réservées aux nouveaux événements.");
for (const { file, source: mediaSeed } of mediaSeedSources) {
  const contentFieldsMatch = mediaSeed.match(/const contentFields = \{([\s\S]*?)\r?\n  \};\r?\n  if \(!existing\.exists\)/);
  assert.ok(contentFieldsMatch, `${file} doit isoler les métadonnées du média de son état collaboratif.`);
  for (const field of ["stage", "publicationBlocked", "archived", "authorUid", "authorLabel", "createdAt", "updatedAt", "updatedBy"]) {
    assert.doesNotMatch(contentFieldsMatch[1], new RegExp(`\\b${field}\\s*:`), `${file} ne doit pas réinitialiser ${field} sur un média existant.`);
  }
  assert.match(mediaSeed, /else \{\s*batch\.set\(reference, contentFields, \{ merge: true \}\);\s*updated \+= 1;/, `${file} doit préserver les décisions d’un média existant.`);
}
console.log(JSON.stringify({ passed: true, mainPosts: 28, totalPosts: posts.length, pairedDays: 8, bilingualPosts: posts.length, historicalPosts: 6, attachedHistoricalMedia: historicalMedia.length, naturePosters: natureMedia.length, editorialMedia: editorialMedia.length, opportunities: 8, internalProjectsSeeded: 12, internalProjectDocuments: internalProjectDocuments.documents.length, movedPost: moved.id, volunteerDate: volunteer.date, contractChecks: 387 }, null, 2));
