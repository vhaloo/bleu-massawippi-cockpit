import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const DATABASE = "(default)";
const NOTICE_ID = "internal-poetry-guide-terrain-20260828-v1";
const ACTION_ID = `content-notice-${NOTICE_ID}`;
const ARCHIVE_ID = "poetry-guide-notice-revision-20260829";
const APPLY = process.argv.includes("--apply");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--apply");
if (unknownArgs.length) throw new Error(`Option inconnue : ${unknownArgs.join(", ")}`);

const manifest = JSON.parse(fs.readFileSync(new URL("./content_notices.json", import.meta.url), "utf8"));
const notice = manifest.notices.find((item) => item.id === NOTICE_ID);
if (!notice) throw new Error(`Nouveauté ${NOTICE_ID} introuvable dans le manifeste.`);
if (notice.assigneeEmail !== "dg@bleumassawippi.com" || notice.audienceRole !== "director") {
  throw new Error("La correction ciblée doit rester dans la file personnelle de la direction.");
}

const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!config.tokens?.access_token || Number(config.tokens.expires_at || 0) < Date.now() + 120_000) {
  throw new Error("Session Firebase CLI expirée; renouveler la session avant cette correction bornée.");
}

const token = config.tokens.access_token;
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}`;
const root = `projects/${PROJECT_ID}/databases/${DATABASE}/documents`;

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "object" && value.$timestamp) return { timestampValue: value.$timestamp };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)])) } };
  }
  throw new Error(`Type Firestore non pris en charge : ${typeof value}.`);
}

function decode(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decode(child)]));
  return undefined;
}

function decodeDocument(document) {
  return Object.fromEntries(Object.entries(document?.fields || {}).map(([key, value]) => [key, decode(value)]));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const raw = await response.text();
  return { ok: response.ok, status: response.status, body: raw ? JSON.parse(raw) : null };
}

const actionResponse = await request(`${base}/documents/actionItems/${ACTION_ID}`);
if (!actionResponse.ok) throw new Error(`Notification privée introuvable ou inaccessible (${actionResponse.status}).`);
const archiveResponse = await request(`${base}/documents/changeArchive/${ARCHIVE_ID}`);
if (!archiveResponse.ok && archiveResponse.status !== 404) throw new Error(`Lecture de l’archive refusée (${archiveResponse.status}).`);

const before = decodeDocument(actionResponse.body);
const desired = {
  title: notice.title,
  message: notice.message,
  eventDateIso: notice.publishedOn,
  priorityKey: notice.priorityKey,
  queueKey: `aq1|${String(before.assigneeUid || "").length}|${before.assigneeUid}|${before.assigneeRole}|p|${String(notice.priorityKey).padStart(4, "0")}|${notice.publishedOn}|${ACTION_ID}`,
  updatedBy: "system_poetry_guide_revision",
  lastMutationId: ARCHIVE_ID
};
const comparisonKeys = ["title", "message", "eventDateIso", "priorityKey", "queueKey"];
const changedFields = comparisonKeys.filter((key) => before[key] !== desired[key]);
const alreadyApplied = changedFields.length === 0;

if (!alreadyApplied && !String(before.message || "").includes("treize paniers")) {
  throw new Error("La notification a changé depuis le dernier audit; correction automatique refusée.");
}
if (archiveResponse.ok && !alreadyApplied) {
  throw new Error("L’archive existe déjà alors que la notification n’est pas corrigée; intervention manuelle requise.");
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  actionId: ACTION_ID,
  statePreserved: before.state || null,
  changedFields,
  legacyQuantityDetected: String(before.message || "").includes("treize paniers"),
  archiveAlreadyExists: archiveResponse.ok,
  writesPlanned: alreadyApplied ? 0 : 2
}, null, 2));

if (!APPLY || alreadyApplied) process.exit(0);

const now = new Date().toISOString();
const beforeTrace = Object.fromEntries(comparisonKeys.map((key) => [key, before[key] ?? null]));
const afterTrace = Object.fromEntries(comparisonKeys.map((key) => [key, desired[key]]));
const archiveFields = {
  entityType: "actionItem",
  entityId: ACTION_ID,
  action: "correction factuelle et mise à jour du guide terrain du 29 août",
  before: beforeTrace,
  after: afterTrace,
  actorUid: "system_poetry_guide_revision",
  actorLabel: "Révision guide terrain",
  createdAt: { $timestamp: now }
};
const actionFields = { ...desired, updatedAt: { $timestamp: now } };
const fieldPaths = Object.keys(actionFields);
const commit = await request(`${base}/documents:commit`, {
  method: "POST",
  body: JSON.stringify({ writes: [
    {
      update: {
        name: `${root}/changeArchive/${ARCHIVE_ID}`,
        fields: Object.fromEntries(Object.entries(archiveFields).map(([key, value]) => [key, encode(value)]))
      },
      currentDocument: { exists: false }
    },
    {
      update: {
        name: `${root}/actionItems/${ACTION_ID}`,
        fields: Object.fromEntries(Object.entries(actionFields).map(([key, value]) => [key, encode(value)]))
      },
      updateMask: { fieldPaths },
      currentDocument: { updateTime: actionResponse.body.updateTime }
    }
  ] })
});
if (!commit.ok) throw new Error(`Correction Firestore refusée (${commit.status}) : ${JSON.stringify(commit.body).slice(0, 600)}`);

const verification = await request(`${base}/documents/actionItems/${ACTION_ID}`);
if (!verification.ok) throw new Error(`Relecture après correction refusée (${verification.status}).`);
const after = decodeDocument(verification.body);
const verificationFailures = comparisonKeys.filter((key) => after[key] !== desired[key]);
if (verificationFailures.length || after.state !== before.state) {
  throw new Error(`Vérification après correction échouée : ${verificationFailures.join(", ") || "état personnel modifié"}.`);
}
console.log(JSON.stringify({
  applied: true,
  writes: 2,
  commitTime: commit.body.commitTime,
  actionId: ACTION_ID,
  archiveId: ARCHIVE_ID,
  statePreserved: after.state,
  verified: true
}, null, 2));
