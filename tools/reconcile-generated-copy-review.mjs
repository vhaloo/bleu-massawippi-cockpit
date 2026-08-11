import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyPlanOverridesToPosts } from "../cockpit/plan-overrides.js";

const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const DATABASE = "(default)";
const CONFIG_PATH = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
const START = process.argv.find((arg) => arg.startsWith("--start="))?.slice(8) || "2026-08-11";
const END = process.argv.find((arg) => arg.startsWith("--end="))?.slice(6) || "2099-12-31";
const APPLY = process.argv.includes("--apply");
if (!/^\d{4}-\d{2}-\d{2}$/.test(START) || !/^\d{4}-\d{2}-\d{2}$/.test(END) || START > END) throw new Error("Fenêtre de dates invalide.");

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
if (!config.tokens?.access_token || Number(config.tokens.expires_at || 0) < Date.now() + 120_000) {
  throw new Error("Session Firebase CLI expirée; renouveler la session avant la réconciliation.");
}
const token = config.tokens.access_token;
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}`;
const documentRoot = `projects/${PROJECT_ID}/databases/${DATABASE}/documents`;
const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const postsJson = html.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
if (!postsJson) throw new Error("Calendrier source illisible.");
const posts = applyPlanOverridesToPosts(JSON.parse(postsJson))
  .filter((post) => post.archivedEditorial !== true && post.dateIso >= START && post.dateIso <= END && String(post.copy || "").trim());

function decode(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  return null;
}

async function firestore(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const workflowByEvent = new Map();
for (let offset = 0; offset < posts.length; offset += 10) {
  const eventIds = posts.slice(offset, offset + 10).map((post) => ({ stringValue: post.id }));
  const rows = await firestore(`${base}/documents:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "workflowStates" }],
      where: { fieldFilter: { field: { fieldPath: "eventId" }, op: "IN", value: { arrayValue: { values: eventIds } } } },
      limit: 20
    } })
  });
  for (const row of rows) {
    if (!row.document) continue;
    const eventId = decode(row.document.fields?.eventId) || row.document.name.split("/").at(-1);
    workflowByEvent.set(eventId, {
      stage: decode(row.document.fields?.stage) || "proposal",
      updateTime: row.document.updateTime,
      updatedByLabel: decode(row.document.fields?.updatedByLabel) || ""
    });
  }
}

const candidates = posts.filter((post) => !workflowByEvent.has(post.id) || workflowByEvent.get(post.id).stage === "proposal");
const report = {
  mode: APPLY ? "apply" : "dry-run",
  start: START,
  end: END,
  textBearingPosts: posts.length,
  workflowReads: workflowByEvent.size,
  candidates: candidates.map((post) => ({ eventId: post.id, dateIso: post.dateIso, title: post.title, before: workflowByEvent.get(post.id)?.stage || "missing", after: "content_review" })),
  preserved: posts.length - candidates.length,
  writesPlanned: candidates.length * 2
};
console.log(JSON.stringify(report, null, 2));
if (!APPLY || !candidates.length) process.exit(0);

const actor = { uid: "6FAy9GJU5qTUlHNelXvtHBsVH3k1", label: "Valentin Wittwe" };
const mutation = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const writes = [];
for (const post of candidates) {
  const current = workflowByEvent.get(post.id);
  const workflowName = `${documentRoot}/workflowStates/${post.id}`;
  const update = {
    name: workflowName,
    fields: {
      eventId: { stringValue: post.id },
      stage: { stringValue: "content_review" },
      updatedBy: { stringValue: actor.uid },
      updatedByLabel: { stringValue: actor.label }
    }
  };
  writes.push({
    update,
    updateMask: { fieldPaths: ["eventId", "stage", "updatedBy", "updatedByLabel"] },
    updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
    currentDocument: current ? { updateTime: current.updateTime } : { exists: false }
  });
  writes.push({
    update: {
      name: `${documentRoot}/changeArchive/generated-copy-review-${post.id}-${mutation}`,
      fields: {
        entityType: { stringValue: "workflowState" },
        entityId: { stringValue: post.id },
        action: { stringValue: "texte préparé par les communications et soumis à la direction" },
        before: { mapValue: { fields: { stage: { stringValue: current?.stage || "proposal" } } } },
        after: { mapValue: { fields: { stage: { stringValue: "content_review" } } } },
        actorUid: { stringValue: actor.uid },
        actorLabel: { stringValue: actor.label }
      }
    },
    updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
    currentDocument: { exists: false }
  });
}

const commit = await firestore(`${base}/documents:commit`, { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, candidates: candidates.length, writes: writes.length, commitTime: commit.commitTime }, null, 2));
