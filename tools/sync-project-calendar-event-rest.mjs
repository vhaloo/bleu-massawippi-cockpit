import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { normalizeProjectCalendarEvent } from "../cockpit/project-calendar-model.mjs";

const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const DATABASE = "(default)";
const APPLY = process.argv.includes("--apply");
const EVENT_ID = process.argv.find((arg) => arg.startsWith("--event="))?.slice(8).trim() || "";
const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");

if (!/^[A-Za-z0-9_-]{3,160}$/.test(EVENT_ID)) {
  throw new Error("Fournir un identifiant borné avec --event=<id>.");
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
if (!config.tokens?.access_token || Number(config.tokens.expires_at || 0) < Date.now() + 120_000) {
  throw new Error("Session Firebase CLI expirée; exécuter d’abord `npx firebase-tools projects:list --json` sans afficher de jeton.");
}
const token = config.tokens.access_token;
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}`;
const documentRoot = `projects/${PROJECT_ID}/databases/${DATABASE}/documents`;

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)])) } };
  }
  throw new Error(`Type non pris en charge : ${typeof value}`);
}

function decode(value = {}) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
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

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "cockpit", "project_calendar_events.json"), "utf8"));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.events)) throw new Error("Manifeste du calendrier de projets invalide.");
const source = manifest.events.find((item) => item.id === EVENT_ID);
if (!source) throw new Error(`Événement absent du manifeste : ${EVENT_ID}.`);
const desired = normalizeProjectCalendarEvent(source);

const currentResult = await request(`${base}/documents/projectCalendarEvents/${EVENT_ID}`);
if (!currentResult.ok) throw new Error(`Lecture de l’événement refusée (${currentResult.status}).`);
const current = decodeDocument(currentResult.body);
const desiredFields = Object.fromEntries(Object.entries(desired).filter(([key]) => key !== "id"));
const changedFields = Object.keys(desiredFields).filter((key) => JSON.stringify(current[key]) !== JSON.stringify(desiredFields[key]));

const adminsResult = await request(`${base}/documents:runQuery`, {
  method: "POST",
  body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: "users" }],
    where: { compositeFilter: { op: "AND", filters: [
      { fieldFilter: { field: { fieldPath: "role" }, op: "EQUAL", value: encode("admin") } },
      { fieldFilter: { field: { fieldPath: "active" }, op: "EQUAL", value: encode(true) } }
    ] } },
    limit: 2
  } })
});
if (!adminsResult.ok) throw new Error(`Vérification du compte communications refusée (${adminsResult.status}).`);
const admins = (adminsResult.body || []).map((row) => row.document).filter(Boolean);
if (admins.length !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.length}).`);
const actorUid = admins[0].name.split("/").at(-1);
const actor = decodeDocument(admins[0]);
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  eventId: EVENT_ID,
  currentUpdateTime: currentResult.body.updateTime,
  changedFields,
  currentSummary: current.summary || "",
  desiredSummary: desired.summary || "",
  reads: 2,
  writesPlanned: changedFields.length ? 2 : 0
}, null, 2));

if (!changedFields.length || !APPLY) process.exit(0);

const seedFields = Object.fromEntries(Object.entries(desiredFields).map(([key, value]) => [key, encode(value)]));
const eventFields = {
  ...seedFields,
  eventId: encode(EVENT_ID),
  createdAt: currentResult.body.fields?.createdAt || { timestampValue: currentResult.body.createTime },
  updatedBy: encode(actorUid),
  updatedByLabel: encode(actorLabel)
};
const fingerprint = crypto.createHash("sha256").update(JSON.stringify(desiredFields)).digest("hex").slice(0, 12);
const archiveId = `project-calendar-${EVENT_ID}-${fingerprint}`.slice(0, 160);
const archiveFields = Object.fromEntries(Object.entries({
  entityType: "projectCalendarEvent",
  entityId: EVENT_ID,
  action: "événement de projet mis à jour",
  before: { title: current.title || "", startDate: current.startDate || "", endDate: current.endDate || "", stage: current.stage || "", summary: current.summary || "" },
  after: { title: desired.title, startDate: desired.startDate, endDate: desired.endDate, stage: desired.stage, summary: desired.summary },
  actorUid,
  actorLabel
}).map(([key, value]) => [key, encode(value)]));

const commit = await request(`${base}/documents:commit`, {
  method: "POST",
  body: JSON.stringify({ writes: [
    {
      update: { name: `${documentRoot}/projectCalendarEvents/${EVENT_ID}`, fields: eventFields },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { updateTime: currentResult.body.updateTime }
    },
    {
      update: { name: `${documentRoot}/changeArchive/${archiveId}`, fields: archiveFields },
      updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false }
    }
  ] })
});
if (!commit.ok) throw new Error(`Synchronisation transactionnelle refusée (${commit.status}): ${JSON.stringify(commit.body)}`);
console.log(JSON.stringify({ applied: true, eventId: EVENT_ID, changedFields, writes: 2, archiveId, commitTime: commit.body.commitTime }, null, 2));
