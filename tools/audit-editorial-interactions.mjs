import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const CONFIG_PATH = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
const rawSince = process.argv.find((value) => value.startsWith("--since="))?.slice(8) || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
const since = new Date(rawSince);
const rawLimit = Number(process.argv.find((value) => value.startsWith("--limit="))?.slice(8) || 60);
const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 60));
if (Number.isNaN(since.valueOf())) throw new Error("--since doit être une date ISO valide.");

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
if (!config.tokens?.access_token || Number(config.tokens.expires_at || 0) < Date.now() + 120_000) {
  throw new Error("Session Firebase CLI expirée; renouveler la session avant la lecture bornée.");
}

const specs = [
  { collection: "comments", timestamp: "updatedAt" },
  { collection: "cockpitFeedback", timestamp: "updatedAt" },
  { collection: "tasks", timestamp: "updatedAt" },
  { collection: "actionItems", timestamp: "updatedAt" },
  { collection: "projectEventProposals", timestamp: "updatedAt" }
];

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

function documentFields(document) {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]));
}

const projected = [
  "actionType", "assignedRole", "authorLabel", "authorRole", "comment", "createdAt", "createdByLabel",
  "eventId", "linkedTargetId", "linkedTargetLabel", "linkedTargetType", "message", "ownerRole", "recipientRole",
  "resolved", "sectionId", "status", "targetId", "targetLabel", "targetType", "taskId", "title", "updatedAt"
];

async function query(spec) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.tokens.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: spec.collection }],
      where: { fieldFilter: { field: { fieldPath: spec.timestamp }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: since.toISOString() } } },
      orderBy: [{ field: { fieldPath: spec.timestamp }, direction: "DESCENDING" }],
      limit
    } })
  });
  if (!response.ok) throw new Error(`${spec.collection}: lecture Firestore refusée (${response.status}).`);
  const rows = await response.json();
  return rows.map((row) => row.document).filter(Boolean).map((document) => {
    const source = documentFields(document);
    const result = { id: String(document.name || "").split("/").at(-1) };
    for (const key of projected) if (source[key] !== undefined) result[key] = source[key];
    return result;
  });
}

const collections = {};
let reads = 0;
for (const spec of specs) {
  collections[spec.collection] = await query(spec);
  reads += collections[spec.collection].length;
}

console.log(JSON.stringify({ since: since.toISOString(), limitPerCollection: limit, matchingReads: reads, collections }, null, 2));
