import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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
  projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
});
const db = getFirestore(app);
const storageBucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.GOOGLE_CLOUD_PROJECT || app.options.projectId}.firebasestorage.app`;
const bucket = getStorage(app).bucket(storageBucketName);

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

const [scheduleItems, comments, logs, feedback, tasks, changeArchive, contentVersions, attachments] = await Promise.all([
  readRecent("scheduleItems"),
  readRecent("comments"),
  readRecent("auditLogs"),
  readRecent("cockpitFeedback"),
  readRecent("tasks"),
  readRecent("changeArchive"),
  readRecent("privateContentVersions"),
  readRecent("attachments")
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

const attachmentOutputDir = path.join(outputDir, "attachments");
await fs.mkdir(attachmentOutputDir, { recursive: true });
const attachmentSync = [];
for (const row of attachments.filter((item) => item.downloadedLocally !== true && item.storagePath)) {
  const safeName = path.basename(String(row.filename || `${row.id}.jpg`)).replace(/[^a-zA-Z0-9._-]+/g, "-") || `${row.id}.jpg`;
  const localPath = path.join(attachmentOutputDir, `${row.id}-${safeName}`);
  try {
    await bucket.file(String(row.storagePath)).download({ destination: localPath });
    await db.collection("attachments").doc(row.id).update({
      downloadedLocally: true,
      downloadedAt: FieldValue.serverTimestamp(),
      localPath: path.relative(workspaceDir, localPath).replaceAll("\\", "/")
    });
    attachmentSync.push({ id: row.id, eventId: row.eventId || null, localPath: path.relative(workspaceDir, localPath).replaceAll("\\", "/"), status: "downloaded" });
  } catch (error) {
    attachmentSync.push({ id: row.id, eventId: row.eventId || null, storagePath: row.storagePath, status: "error", error: String(error?.message || error) });
  }
}

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
  attachments: attachments.map((row) => ({
    id: row.id,
    eventId: row.eventId || null,
    filename: row.filename || null,
    storagePath: row.storagePath || null,
    sizeBytes: row.sizeBytes || null,
    width: row.width || null,
    height: row.height || null,
    downloadedLocally: row.downloadedLocally === true,
    archived: row.archived === true,
    createdAt: dateValue(row.createdAt)?.toISOString() || null
  })),
  attachmentSync
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
  attachments: summary.attachments.length,
  attachmentsDownloaded: attachmentSync.filter((item) => item.status === "downloaded").length,
  attachmentsErrors: attachmentSync.filter((item) => item.status === "error").length
}, null, 2));
