import assert from "node:assert/strict";
import fs from "node:fs";

const firebase = fs.readFileSync(new URL("./firebase-client.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const healthUi = fs.readFileSync(new URL("./client-health-ui.js", import.meta.url), "utf8");
const adminLazyUi = fs.readFileSync(new URL("./admin-lazy-data.js", import.meta.url), "utf8");
const eventContext = fs.readFileSync(new URL("./event-context-data.js", import.meta.url), "utf8");

for (const token of [
  "persistentLocalCache",
  "persistentMultipleTabManager",
  "clearIndexedDbPersistence",
  "terminate",
  "disableNetwork",
  "safeModeRequested",
  "requireWritable",
  "trackedOnSnapshot",
  "subscribeClientDiagnostics",
  "recordConfirmedWrites"
]) {
  assert.ok(firebase.includes(token), `Le client résilient doit conserver ${token}.`);
}

assert.match(firebase, /safeModeRequested[\s\S]{0,220}persistentCacheRequested/,
  "Le mode secours doit exiger le cache persistant avant de couper le réseau.");
assert.match(firebase, /networkReady = disableNetwork\(db\)/,
  "Le mode secours doit couper Firestore au niveau du SDK, pas seulement masquer les boutons.");
assert.match(firebase, /function requireWritable\(\)[\s\S]{0,220}mode secours est en lecture seule/,
  "Toutes les mutations doivent pouvoir être bloquées par le client en mode secours.");
assert.match(firebase, /function changeArchiveEntry\([\s\S]{0,900}createdAt: serverTimestamp\(\)/,
  "Les mutations atomiques doivent partager une archive de changement normalisée.");
for (const name of ["addComment", "updateOwnComment", "archiveOwnComment", "resolveComment"]) {
  const start = firebase.indexOf(`export async function ${name}`);
  const end = firebase.indexOf("\nexport ", start + 10);
  const body = firebase.slice(start, end < 0 ? undefined : end);
  assert.match(body, /writeBatch\(db\)/, `${name} doit préparer la donnée et son archive dans un lot atomique.`);
  assert.match(body, /await batch\.commit\(\)/, `${name} doit valider le lot atomique en une seule opération réseau.`);
}
assert.equal((firebase.match(/export async function /g) || []).length > 10, true);

const writeFunctions = [
  "updateScheduleItem", "upsertScheduleItem", "setScheduleSelection", "addComment",
  "updateOwnComment", "archiveOwnComment", "resolveComment", "setWorkflowStage",
  "setOpportunityStage", "setInternalProjectStage", "setEditorialDecision", "addMediaLink",
  "archiveMediaLink", "setMediaDecision", "setMediaFinalChoice", "writeAuditLog",
  "addCockpitFeedback", "upsertActionTask", "completeActionTask",
  "setPersonalActionItemState", "updateCockpitFeedbackStatus"
];
for (const name of writeFunctions) {
  assert.match(firebase, new RegExp(`export async function ${name}\\([^)]*\\) \\{\\s*requireWritable\\(\\);`),
    `${name} doit refuser une écriture en mode secours.`);
}

for (const listener of [
  "scheduleItems", "comments", "workflowStates", "opportunityStates",
  "internalProjectStates", "editorialDecisions", "mediaDecisions", "mediaLinks",
  "tasks", "personalActionItems", "cockpitFeedback", "auditLogs"
]) {
  assert.match(firebase, new RegExp(`trackedOnSnapshot\\(\\s*"${listener}"`),
    `Le listener ${listener} doit passer par le registre central.`);
}

for (const [collectionName, maximum] of [["scheduleItems",120],["comments",120],["workflowStates",100],["opportunityStates",50],["internalProjectStates",50],["editorialDecisions",100],["mediaDecisions",80],["mediaLinks",160]]) {
  assert.match(firebase, new RegExp(`collection\\(db, "${collectionName}"\\)[\\s\\S]{0,180}limit\\(${maximum}\\)`),
    `La fenêtre ${collectionName} doit rester bornée à ${maximum} documents.`);
}
assert.match(firebase, /export function subscribeCommentsForSection[\s\S]{0,500}where\("sectionId", "==", sectionId\)[\s\S]{0,220}limit\(60\)/,
  "Un événement ouvert doit obtenir uniquement son mini-chat, avec une limite fixe.");
assert.match(firebase, /export function subscribeMediaLinksForEvent[\s\S]{0,500}where\("eventId", "==", eventId\)[\s\S]{0,220}limit\(40\)/,
  "Un événement ouvert doit obtenir uniquement ses médias, avec une limite fixe.");
assert.match(eventContext, /function createEventContextController\([\s\S]{0,1200}subscribeCommentsForSection[\s\S]{0,1200}subscribeMediaLinksForEvent/,
  "Le cockpit doit partager un seul contexte temps réel pour l’événement consulté.");
assert.match(ui, /createEventContextController\([\s\S]{0,1300}eventContextController\.activate\(eventId\)/,
  "Le module principal doit activer le contexte partagé seulement pour la carte consultée.");

const healthStart = healthUi.indexOf("export function buildHealthWidget");
const healthSource = healthUi.slice(healthStart);
assert.ok(healthStart >= 0, "Le widget de santé réservé aux communications doit exister.");
assert.doesNotMatch(healthSource, /subscribeScheduleItems|subscribeMediaLinks|subscribeComments|getDoc|getDocs/,
  "Ouvrir le widget de santé ne doit déclencher aucune lecture Firebase.");
assert.match(ui, /startAdminLazyData\([^;]+[\s\S]{0,1200}scheduleAdminLazyDataStop\(\);/,
  "Le journal et les rétroactions doivent suivre l’ouverture du panneau administratif.");
assert.match(adminLazyUi, /subscribeAuditLogs/);
assert.match(adminLazyUi, /subscribeCockpitFeedback/);
assert.match(adminLazyUi, /setTimeout\([\s\S]{0,600}auditUnsubscribe\?\.\(\)/,
  "La fermeture doit désabonner les listeners paresseux après une courte grâce.");
assert.match(ui, /if \(safeMode\) \{[\s\S]{0,2200}return;/,
  "Le mode secours doit court-circuiter les listeners non essentiels.");
assert.match(ui, /function canEdit\(\) \{\s*return Boolean\(!safeMode/,
  "L’interface doit aussi devenir explicitement non modifiable en mode secours.");
assert.match(healthUi, /Ouvrir ce panneau n’ajoute aucune lecture Firebase/);
assert.match(healthUi, /Estimations locales seulement/);

console.log(`✓ résilience client : ${writeFunctions.length} mutations gardées, 12 listeners suivis, widget sans lecture`);
