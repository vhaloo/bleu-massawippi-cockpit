import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertProtectedScheduleChange, sameSeedFields } from "./seed_utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(here, name), "utf8");

assert.equal(sameSeedFields({ a: 1, b: [2] }, { a: 1, b: [2] }), true);
assert.equal(sameSeedFields({ a: 1 }, { a: 2 }), false);

const protectedMove = {
  eventId: "post-termine",
  before: { dateIso: "2026-08-04", dateKey: "Mardi 4 août", calendarTime: "12:00" },
  after: { dateIso: "2026-08-09", dateKey: "Dimanche 9 août", calendarTime: "09:00" },
  workflowStage: "published"
};
assert.throws(() => assertProtectedScheduleChange(protectedMove), /Déplacement refusé/,
  "Une publication programmée ou publiée ne doit jamais être déplacée silencieusement.");
assert.equal(assertProtectedScheduleChange({ ...protectedMove, workflowStage: "content_approved" }).overrideUsed, false,
  "Une proposition encore éditable peut être replanifiée sans faux verrou de publication.");
assert.throws(() => assertProtectedScheduleChange({
  ...protectedMove,
  allowedEventIds: new Set(["post-termine"]),
  reason: "trop court"
}), /20 caractères minimum/,
"Un override de sécurité doit toujours être motivé.");
const authorizedRepair = assertProtectedScheduleChange({
  ...protectedMove,
  allowedEventIds: new Set(["post-termine"]),
  reason: "Correction explicitement autorisée pour restaurer le créneau publié."
});
assert.equal(authorizedRepair.overrideUsed, true);
assert.deepEqual(authorizedRepair.changedFields, ["dateIso", "dateKey", "calendarTime"]);

for (const file of [
  "seed_editorial_media_links.js",
  "seed_historical_media_links.js",
  "seed_nature_media_links.js",
  "seed_internal_project_states.js",
  "seed_content_notices.js",
  "seed_opportunity_states.js",
  "seed_media_config.js",
  "seed_private_content.js",
  "seed_open_house_attachments.js"
]) {
  const source = read(file);
  assert.match(source, /dryRun|isDryRun|--dry-run/, `${file} doit offrir une validation sans écriture.`);
}

for (const file of ["seed_editorial_media_links.js", "seed_historical_media_links.js", "seed_nature_media_links.js"]) {
  const source = read(file);
  assert.match(source, /sameSeedFields/);
  assert.match(source, /created \+ updated > 0/);
  assert.match(source, /unchanged/);
}
assert.match(read("seed_editorial_media_links.js"), /archived: true, selectedFinal: false, stage: "archived"/,
  "Un média archivé doit quitter aussi le stade proposition sans modifier le stade des médias actifs.");
assert.match(read("seed_historical_media_links.js"), /--event=/,
  "La banque historique doit pouvoir être synchronisée par événement afin d’éviter une relecture globale.");

assert.match(read("seed_private_content.js"), /contentChanged/);
assert.match(read("seed_private_content.js"), /if \(writeOperations > 0\) await batch\.commit\(\)/);
assert.match(read("seed_private_content.js"), /mainPosts\.length < 28/,
  "La synchronisation doit accepter un calendrier durable au-delà des 28 publications initiales.");
assert.match(read("seed_private_content.js"), /--ids=/,
  "La synchronisation privée doit pouvoir cibler seulement les publications modifiées.");
assert.match(read("seed_private_content.js"), /for \(const post of contentOnly \? \[\] : selectedPosts\)/,
  "Une synchronisation ciblée ne doit pas relire tous les documents scheduleItems.");
assert.match(read("seed_private_content.js"), /workflowStates[\s\S]*assertProtectedScheduleChange/,
  "Le semeur doit vérifier le workflow avant tout déplacement d’un créneau protégé.");
assert.match(read("seed_private_content.js"), /--allow-completed-reschedule=/,
  "Une correction exceptionnelle doit exiger un override ciblé et explicite.");
assert.match(read("seed_private_content.js"), /completedScheduleOverrideReason/,
  "Toute correction autorisée d’un créneau terminé doit être consignée dans l’archive.");
assert.match(read("seed_open_house_attachments.js"), /disabledByDefault: true/);
assert.match(read("seed_content_notices.js"), /if \(existing\.exists\)[\s\S]*preserved \+= 1/);
assert.match(read("seed_content_notices.js"), /Une version vue ne doit jamais être rouverte/);
const contentNotices = JSON.parse(read("content_notices.json"));
assert.equal(contentNotices.schemaVersion, 1);
assert.equal(contentNotices.notices.length, 15);
assert.ok(contentNotices.notices.every((item) => item.audienceRole === "director" && item.assigneeEmail === "dg@bleumassawippi.com"));
for (const id of ["strategic-zeffy-recurring-gifts-v1", "internal-application-funding-nonmunicipal-v1", "internal-poetry-progress-v2", "internal-poetry-progress-v3", "internal-youth-drawing-toolkit-v1", "strategic-guide-pratiques-aquatiques-2026-v1", "internal-lamproie-report-requested-v1", "internal-poetry-progress-20260810-v1"]) {
  assert.ok(contentNotices.notices.some((item) => item.id === id), `La nouveauté ${id} doit être versionnée dans le manifeste.`);
}

const projectDecisions = JSON.parse(read("project_decisions.json"));
assert.equal(projectDecisions.schemaVersion, 1);
assert.equal(projectDecisions.decisions.length, 4);
assert.equal(projectDecisions.decisions.filter((item) => item.audienceRole === "director" && item.assigneeEmail === "dg@bleumassawippi.com").length, 2);
assert.equal(projectDecisions.decisions.filter((item) => item.audienceRole === "admin" && item.assigneeEmail === "communication@bleumassawippi.com").length, 2);
assert.ok(projectDecisions.decisions.some((item) => item.id === "suivi-plages-reviser-offre-20260804-v1"), "La révision de l’ébauche Suivi des plages doit rester dans la file Communications.");
assert.match(read("seed_project_decisions.js"), /if \(existing\.exists\)/, "Le semeur de décisions doit préserver les entrées existantes.");
assert.match(read("seed_project_decisions.js"), /actionType: "project_decision"/);
const editorialCycleReconciliation = read("reconcile_editorial_cycle_20260804.js");
assert.match(editorialCycleReconciliation, /const snapshot = transaction \? await transaction\.get\(ref\) : await ref\.get\(\);/,
  "La réconciliation doit attendre chaque lecture Firestore avant d’inspecter le document.");
assert.match(editorialCycleReconciliation, /updateRadioAction\(\)/,
  "Une décision déjà semée doit être mise à jour explicitement plutôt que remplacée ou dupliquée.");
assert.match(editorialCycleReconciliation, /PLANNED_MEDIA_PREREQUISITES/,
  "Le dry-run pré-déploiement doit distinguer les médias planifiés des données réellement absentes.");
console.log("Contrat d’idempotence des synchronisations : OK");
