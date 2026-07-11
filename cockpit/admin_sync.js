import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = new Map();
for (const raw of process.argv.slice(2)) {
  const [key, value = "true"] = raw.replace(/^--/, "").split("=");
  args.set(key, value);
}

const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
const days = Number(args.get("days") || 14);
const outputDir = path.resolve(workspaceDir, args.get("output") || "./sync-output");
if (!Number.isFinite(days) || days < 1 || days > 366) {
  console.error("--days doit être un nombre entre 1 et 366.");
  process.exit(2);
}
if (!outputDir.startsWith(workspaceDir + path.sep)) {
  console.error("--output doit rester dans le dossier cockpit.");
  process.exit(2);
}
const sinceMs = Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS n’est pas défini.");
  console.error("Définissez-le dans PowerShell vers votre clé de compte de service, sans placer cette clé dans le dépôt.");
  process.exit(2);
}

const app = initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined
});
const db = getFirestore(app);

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  return null;
}

function isRecent(data) {
  const changed = dateValue(data.updatedAt) || dateValue(data.createdAt);
  return changed ? changed.valueOf() >= sinceMs : true;
}

async function readRecent(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter(isRecent);
}

await fs.mkdir(outputDir, { recursive: true });

const [scheduleItems, comments, logs, feedback, tasks, changeArchive, contentVersions, mediaLinks, workflowStates, editorialDecisions] = await Promise.all([
  readRecent("scheduleItems"),
  readRecent("comments"),
  readRecent("auditLogs"),
  readRecent("cockpitFeedback"),
  readRecent("tasks"),
  readRecent("changeArchive"),
  readRecent("privateContentVersions"),
  readRecent("mediaLinks"),
  readRecent("workflowStates"),
  readRecent("editorialDecisions")
]);

const changedScheduleItems = scheduleItems.filter((row) =>
  row.deleted === true || ["approved", "needs_work", "pending", "deleted"].includes(row.status)
);

const dictatedComments = comments
  .filter((row) => row.dictated === true)
  .map((row) => ({
    id: row.id,
    sectionId: row.sectionId || null,
    comment: row.comment || "",
    quickTag: row.quickTag || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null
  }));

const summary = {
  generatedAt: new Date().toISOString(),
  since: new Date(sinceMs).toISOString(),
  scheduleItems: changedScheduleItems.map((row) => ({
    id: row.id,
    title: row.title || null,
    dateKey: row.dateKey || null,
    tasksValentin: Array.isArray(row.tasksValentin) ? row.tasksValentin : [],
    tasksAnnie: Array.isArray(row.tasksAnnie) ? row.tasksAnnie : [],
    calendarTime: row.calendarTime || null,
    calendarDurationMinutes: row.calendarDurationMinutes || null,
    calendarLocation: row.calendarLocation || null,
    calendarCost: row.calendarCost || null,
    status: row.status || "pending",
    deleted: row.deleted === true,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  })),
  comments: comments.map((row) => ({
    id: row.id,
    sectionId: row.sectionId || null,
    dictated: row.dictated === true,
    quickTag: row.quickTag || null,
    comment: row.comment || "",
    resolved: row.resolved === true,
    resolvedByLabel: row.resolvedByLabel || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null
  })),
  dictatedComments,
  auditLogs: logs.map((row) => ({
    id: row.id,
    action: row.action || null,
    sectionId: row.sectionId || null,
    userUid: row.userUid || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null
  })),
  cockpitFeedback: feedback.map((row) => ({
    id: row.id,
    sectionId: row.sectionId || null,
    category: row.category || "recommendation",
    status: row.status || "open",
    message: row.message || "",
    authorLabel: row.authorLabel || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  })),
  tasks: tasks.map((row) => ({
    id: row.id,
    title: row.title || null,
    status: row.status || "pending",
    targetType: row.targetType || null,
    targetId: row.targetId || null,
    targetLabel: row.targetLabel || null,
    message: row.message || "",
    createdByLabel: row.createdByLabel || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  })),
  changeArchive: changeArchive.map((row) => ({
    id: row.id,
    entityType: row.entityType || null,
    entityId: row.entityId || null,
    action: row.action || null,
    before: row.before || {},
    after: row.after || {},
    actorLabel: row.actorLabel || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null
  })),
  privateContentVersions: contentVersions.map((row) => ({
    id: row.id,
    contentHash: row.contentHash || null,
    source: row.source || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    bytes: Buffer.byteLength(JSON.stringify({ css: row.css || "", html: row.html || "", script: row.script || "" }), "utf8")
  })),
  mediaLinks: mediaLinks.map((row) => ({
    id: row.id,
    eventId: row.eventId || null,
    label: row.label || null,
    url: row.url || null,
    kind: row.kind || "other",
    stage: row.stage || "reference",
    note: row.note || "",
    archived: row.archived === true,
    authorLabel: row.authorLabel || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  })),
  workflowStates: workflowStates.map((row) => ({ id: row.id, eventId: row.eventId || row.id, stage: row.stage || "proposal", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null })),
  editorialDecisions: editorialDecisions.map((row) => ({ id: row.id, eventId: row.eventId || row.id, decision: row.decision || "undecided", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null }))
};

const outputFile = path.join(outputDir, "sync-summary.json");
await fs.writeFile(outputFile, JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify({
  outputFile,
  scheduleItems: summary.scheduleItems.length,
  comments: summary.comments.length,
  dictatedComments: summary.dictatedComments.length,
  cockpitFeedback: summary.cockpitFeedback.length,
  tasks: summary.tasks.length,
  changeArchive: summary.changeArchive.length,
  privateContentVersions: summary.privateContentVersions.length,
  mediaLinks: summary.mediaLinks.length,
  workflowStates: summary.workflowStates.length,
  editorialDecisions: summary.editorialDecisions.length
}, null, 2));
