import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const DATABASE = "(default)";
const DIRECTOR_UID = "3wXu7TuOE5OMIBiohOtH1vpUVf43";
const APPLY = process.argv.includes("--apply");
const PUBLISHED_ON = process.argv.find((arg) => arg.startsWith("--published-on="))?.slice(15) || "2026-08-11";
const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "cockpit", "content_notices.json"), "utf8"));
const selected = manifest.notices.filter((notice) => notice.publishedOn === PUBLISHED_ON);
if (!selected.length) throw new Error(`Aucune nouveauté datée du ${PUBLISHED_ON}.`);
if (selected.some((notice) => notice.audienceRole !== "director" || notice.assigneeEmail !== "dg@bleumassawippi.com")) {
  throw new Error("Cette exécution ciblée ne peut alimenter que la file personnelle de la direction.");
}

const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config", "configstore", "firebase-tools.json"), "utf8"));
if (!config.tokens?.access_token || Number(config.tokens.expires_at || 0) < Date.now() + 120_000) {
  throw new Error("Session Firebase CLI expirée; la renouveler avant l’amorçage ciblé.");
}
const token = config.tokens.access_token;
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}`;

function encode(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  throw new Error(`Valeur Firestore non prise en charge : ${typeof value}.`);
}

function decode(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  return undefined;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const raw = await response.text();
  return { ok: response.ok, status: response.status, body: raw ? JSON.parse(raw) : null };
}

const profile = await request(`${base}/documents/users/${DIRECTOR_UID}`);
if (!profile.ok
  || decode(profile.body.fields?.role) !== "director"
  || decode(profile.body.fields?.active) !== true) {
  throw new Error("Le profil actif de la direction n’a pas pu être confirmé; aucune écriture effectuée.");
}

function queueKey(item, actionId) {
  return `aq1|${item.assigneeUid.length}|${item.assigneeUid}|${item.assigneeRole}|p|${String(item.priorityKey).padStart(4, "0")}|${item.eventDateIso}|${actionId}`;
}

const create = [];
let preserved = 0;
for (const notice of selected) {
  const actionId = `content-notice-${notice.id}`;
  const existing = await request(`${base}/documents/actionItems/${actionId}`);
  if (existing.ok) {
    preserved += 1;
    continue;
  }
  if (existing.status !== 404) throw new Error(`Lecture refusée pour ${actionId} (${existing.status}).`);
  const item = {
    assigneeUid: DIRECTOR_UID,
    assigneeRole: "director",
    state: "pending",
    sourceType: notice.sourceType,
    sourceId: notice.sourceId,
    mediaId: "",
    eventDateIso: notice.publishedOn,
    actionType: "content_notice",
    title: notice.title,
    message: notice.message,
    priorityKey: notice.priorityKey,
    createdByUid: "system_content_notice",
    updatedBy: "system_content_notice",
    lastMutationId: `seed-${notice.id}`,
    schemaVersion: 1
  };
  item.queueKey = queueKey(item, actionId);
  create.push({ actionId, item });
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  publishedOn: PUBLISHED_ON,
  profileReads: 1,
  actionReads: selected.length,
  selected: selected.length,
  candidates: create.length,
  preserved,
  writesPlanned: create.length,
  actionIds: create.map(({ actionId }) => actionId)
}, null, 2));

if (!APPLY || !create.length) process.exitCode = 0;
else {
  const writes = create.map(({ actionId, item }) => ({
    update: {
      name: `${base}/documents/actionItems/${actionId}`,
      fields: Object.fromEntries(Object.entries(item).map(([key, value]) => [key, encode(value)]))
    },
    updateTransforms: [
      { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
      { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }
    ],
    currentDocument: { exists: false }
  }));
  const result = await request(`${base}/documents:commit`, { method: "POST", body: JSON.stringify({ writes }) });
  if (!result.ok) throw new Error(`Amorçage Firestore refusé (${result.status}).`);
  console.log(JSON.stringify({ applied: true, created: create.length, writes: writes.length, commitTime: result.body.commitTime }, null, 2));
}
