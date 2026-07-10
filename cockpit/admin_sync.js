import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const args = new Map();
for (const raw of process.argv.slice(2)) {
  const [key, value = "true"] = raw.replace(/^--/, "").split("=");
  args.set(key, value);
}

const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
const days = Number(args.get("days") || 14);
const outputDir = path.resolve(workspaceDir, args.get("output") || "./sync-output");
const noDownload = args.get("no-download") === "true";
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

function safeName(value) {
  return String(value || "piece-jointe").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160);
}

async function readRecent(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter(isRecent);
}

async function downloadAttachment(row) {
  if (!row.storagePath) return { id: row.id, ok: false, reason: "storagePath manquant" };
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) return { id: row.id, ok: false, reason: "FIREBASE_STORAGE_BUCKET manquant" };
  const target = path.join(outputDir, "attachments", row.id + "-" + safeName(row.fileName));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await getStorage(app).bucket(bucketName).file(row.storagePath).download({ destination: target });
  await db.collection("attachments").doc(row.id).update({
    downloaded_locally: true,
    downloadedAt: new Date(),
    downloadedBy: "admin_sync"
  });
  return { id: row.id, ok: true, path: target };
}

await fs.mkdir(outputDir, { recursive: true });

const [scheduleItems, comments, logs, attachments] = await Promise.all([
  readRecent("scheduleItems"),
  readRecent("comments"),
  readRecent("auditLogs"),
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

const attachmentsToDownload = attachments.filter((row) => row.downloaded_locally === false);
const downloaded = [];
if (!noDownload) {
  for (const row of attachmentsToDownload) {
    try {
      downloaded.push(await downloadAttachment(row));
    } catch (error) {
      downloaded.push({ id: row.id, ok: false, reason: error.message });
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  since: new Date(sinceMs).toISOString(),
  scheduleItems: changedScheduleItems.map((row) => ({
    id: row.id,
    title: row.title || null,
    dateKey: row.dateKey || null,
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
  attachments: {
    pending: attachmentsToDownload.length,
    results: downloaded
  }
};

const outputFile = path.join(outputDir, "sync-summary.json");
await fs.writeFile(outputFile, JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify({
  outputFile,
  scheduleItems: summary.scheduleItems.length,
  comments: summary.comments.length,
  dictatedComments: summary.dictatedComments.length,
  pendingAttachments: summary.attachments.pending,
  downloaded: downloaded.filter((item) => item.ok).length
}, null, 2));
