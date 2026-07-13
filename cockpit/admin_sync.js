import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HELP = `
Synchronisation et sauvegarde du Cockpit Communication Bleu

Usage :
  node admin_sync.js [--days=N]
  node admin_sync.js --audit-export
  node admin_sync.js --help

Options :
  --days=N   Résumé des changements des N derniers jours (1 à 366, défaut : 14).
  --audit-export
             Export logique assaini et horodaté des collections de premier niveau.
  --full     Alias historique de --audit-export; ce n’est pas une sauvegarde de reprise.
  --output=P Sous-dossier de sortie sous cockpit/sync-output (mode quotidien seulement).
  --help     Affiche cette aide sans exiger de connexion ni de clé Firebase.

Authentification :
  Définir GOOGLE_APPLICATION_CREDENTIALS vers une clé de compte de service locale.
  La clé et les variables d’environnement ne sont jamais copiées dans les sorties.
`;

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) continue;
    const withoutPrefix = raw.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");
    if (equalsIndex >= 0) {
      parsed.set(withoutPrefix.slice(0, equalsIndex), withoutPrefix.slice(equalsIndex + 1));
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed.set(withoutPrefix, next);
      index += 1;
    } else {
      parsed.set(withoutPrefix, "true");
    }
  }
  return parsed;
}

const args = parseArgs(process.argv.slice(2));
if (args.has("help") || args.has("h")) {
  console.log(HELP.trim());
  process.exit(0);
}

const allowedArgs = new Set(["days", "audit-export", "full", "output", "help", "h"]);
const unknownArgs = [...args.keys()].filter((name) => !allowedArgs.has(name));
if (unknownArgs.length) {
  console.error(`Option inconnue : --${unknownArgs.join(", --")}`);
  process.exit(2);
}
if ((args.has("audit-export") || args.has("full")) && (args.has("days") || args.has("output"))) {
  console.error("--audit-export/--full ne peut pas être combiné avec --days ou --output.");
  process.exit(2);
}

const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
const syncOutputRoot = path.join(workspaceDir, "sync-output");
const days = Number(args.get("days") || 14);
const requestedOutput = args.get("output") || ".";
const requestedOutputFromWorkspace = path.resolve(workspaceDir, requestedOutput);
const outputDir = requestedOutputFromWorkspace === syncOutputRoot || requestedOutputFromWorkspace.startsWith(syncOutputRoot + path.sep)
  ? requestedOutputFromWorkspace
  : path.resolve(syncOutputRoot, requestedOutput);
const fullMode = ["audit-export", "full"].some((name) => args.has(name) && args.get(name) !== "false");

if (!fullMode && (!Number.isFinite(days) || days < 1 || days > 366)) {
  console.error("--days doit être un nombre entre 1 et 366.");
  process.exit(2);
}
if (outputDir !== syncOutputRoot && !outputDir.startsWith(syncOutputRoot + path.sep)) {
  console.error("--output doit rester sous cockpit/sync-output.");
  process.exit(2);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS n’est pas défini.");
  console.error("Définissez-le dans PowerShell vers votre clé de compte de service, sans placer cette clé dans le dépôt.");
  process.exit(2);
}

const [{ applicationDefault, initializeApp }, { getFirestore }] = await Promise.all([
  import("firebase-admin/app"),
  import("firebase-admin/firestore")
]);
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

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function safeFileName(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "collection";
}

const SECRET_FIELD = /(?:password|passwd|secret|private[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)/i;

function normalizeFirestoreValue(value, logicalPath, redactions) {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value ?? null;
  }
  if (value instanceof Date || typeof value?.toDate === "function") {
    const date = value instanceof Date ? value : value.toDate();
    return { __firestoreType: "timestamp", value: date.toISOString() };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __firestoreType: "bytes", value: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeFirestoreValue(entry, `${logicalPath}[${index}]`, redactions));
  }
  if (typeof value?.latitude === "number" && typeof value?.longitude === "number") {
    return { __firestoreType: "geoPoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (typeof value?.path === "string" && value.firestore) {
    return { __firestoreType: "documentReference", path: value.path };
  }
  if (typeof value === "object") {
    const normalized = {};
    for (const [key, entry] of Object.entries(value)) {
      const entryPath = logicalPath ? `${logicalPath}.${key}` : key;
      if (SECRET_FIELD.test(key)) {
        normalized[key] = "[REDACTED]";
        redactions.push(entryPath);
      } else {
        normalized[key] = normalizeFirestoreValue(entry, entryPath, redactions);
      }
    }
    return normalized;
  }
  return String(value);
}

async function createUniqueDirectory(root, prefix) {
  await fs.mkdir(root, { recursive: true });
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidateName = suffix === 0 ? prefix : `${prefix}-${String(suffix).padStart(3, "0")}`;
    const candidate = path.join(root, candidateName);
    try {
      await fs.mkdir(candidate, { recursive: false });
      return candidate;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  throw new Error("Impossible de créer un dossier de sauvegarde unique.");
}

async function writeJsonAndDescribe(backupDir, relativePath, payload) {
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const absolutePath = path.join(backupDir, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, { encoding: "utf8", flag: "wx" });
  return {
    path: relativePath.split(path.sep).join("/"),
    bytes: Buffer.byteLength(content, "utf8"),
    sha256: sha256(content)
  };
}

const BUSINESS_COLLECTIONS = [
  "attachments",
  "auditLogs",
  "changeArchive",
  "cockpitFeedback",
  "comments",
  "editorialDecisions",
  "internalProjectStates",
  "mediaLinks",
  "opportunityStates",
  "privateConfig",
  "privateContent",
  "privateContentVersions",
  "scheduleItems",
  "tasks",
  "users",
  "workflowStates"
];

async function runAuditExport() {
  const generatedAt = new Date();
  const backupDir = await createUniqueDirectory(syncOutputRoot, `backup-${timestampSlug(generatedAt)}`);
  const inProgressPath = path.join(backupDir, "EXPORT_IN_PROGRESS.json");
  await fs.writeFile(inProgressPath, `${JSON.stringify({
    schemaVersion: 1,
    status: "in-progress",
    generatedAt: generatedAt.toISOString(),
    projectId: app.options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "unconfirmed",
    databaseId: "(default)"
  }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  const discovered = await db.listCollections();
  const collectionNames = [...new Set([...BUSINESS_COLLECTIONS, ...discovered.map((reference) => reference.id)])].sort();
  const files = [];
  const collections = [];
  const redactions = [];

  try {
    for (const collectionName of collectionNames) {
      const snapshot = await db.collection(collectionName).get();
      const documents = snapshot.docs.map((document) => ({
        id: document.id,
        path: document.ref.path,
        data: normalizeFirestoreValue(document.data(), document.ref.path, redactions)
      }));
      const relativePath = path.join("collections", `${safeFileName(collectionName)}.json`);
      const file = await writeJsonAndDescribe(backupDir, relativePath, {
        schemaVersion: 1,
        generatedAt: generatedAt.toISOString(),
        collection: collectionName,
        documentCount: documents.length,
        documents
      });
      files.push(file);
      collections.push({ name: collectionName, documentCount: documents.length, file: file.path });
    }

    const summary = {
      schemaVersion: 1,
      generatedAt: generatedAt.toISOString(),
      exportType: "firestore-sanitized-first-level-audit",
      disasterRecoveryBackup: false,
      projectId: app.options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "unconfirmed",
      databaseId: "(default)",
      scope: "top-level-collections-only",
      restorePolicy: "not-restorable-as-is",
      collectionCount: collections.length,
      documentCount: collections.reduce((total, collection) => total + collection.documentCount, 0),
      collections,
      redactionCount: redactions.length,
      redactedFieldPaths: redactions,
      credentialFilesIncluded: false,
      environmentValuesIncluded: false
    };
    files.push(await writeJsonAndDescribe(backupDir, "backup-summary.json", summary));

    const manifest = {
      schemaVersion: 1,
      algorithm: "SHA-256",
      generatedAt: generatedAt.toISOString(),
      files: [...files].sort((left, right) => left.path.localeCompare(right.path))
    };
    const manifestFile = await writeJsonAndDescribe(backupDir, "manifest.json", manifest);
    const manifestChecksum = `${manifestFile.sha256}  manifest.json\n`;
    await fs.writeFile(path.join(backupDir, "manifest.sha256"), manifestChecksum, { encoding: "utf8", flag: "wx" });
    await fs.writeFile(path.join(backupDir, "EXPORT_COMPLETE.json"), `${JSON.stringify({
      schemaVersion: 1,
      status: "complete",
      completedAt: new Date().toISOString(),
      manifestSha256: manifestFile.sha256
    }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fs.unlink(inProgressPath);

    console.log(JSON.stringify({
      backupDir,
      generatedAt: generatedAt.toISOString(),
      collections: summary.collectionCount,
      documents: summary.documentCount,
      redactedFields: summary.redactionCount,
      manifest: path.join(backupDir, "manifest.json"),
      manifestSha256: manifestFile.sha256
    }, null, 2));
  } catch (error) {
    const failure = {
      generatedAt: new Date().toISOString(),
      status: "incomplete",
      message: String(error?.message || error)
    };
    await fs.writeFile(path.join(backupDir, "EXPORT_INCOMPLETE.json"), `${JSON.stringify(failure, null, 2)}\n`, "utf8");
    throw error;
  }
}

if (fullMode) {
  await runAuditExport();
  process.exit(0);
}

const sinceMs = Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000;

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

const [scheduleItems, comments, logs, feedback, tasks, changeArchive, contentVersions, mediaLinks, workflowStates, editorialDecisions, opportunityStates, internalProjectStates] = await Promise.all([
  readRecent("scheduleItems"),
  readRecent("comments"),
  readRecent("auditLogs"),
  readRecent("cockpitFeedback"),
  readRecent("tasks"),
  readRecent("changeArchive"),
  readRecent("privateContentVersions"),
  readRecent("mediaLinks"),
  readRecent("workflowStates"),
  readRecent("editorialDecisions"),
  readRecent("opportunityStates"),
  readRecent("internalProjectStates")
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
  editorialDecisions: editorialDecisions.map((row) => ({ id: row.id, eventId: row.eventId || row.id, decision: row.decision || "undecided", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null })),
  opportunityStates: opportunityStates.map((row) => ({ id: row.id, opportunityId: row.opportunityId || row.id, stage: row.stage || "watch", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null })),
  internalProjectStates: internalProjectStates.map((row) => ({ id: row.id, projectId: row.projectId || row.id, stage: row.stage || "to_frame", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null }))
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
  editorialDecisions: summary.editorialDecisions.length,
  opportunityStates: summary.opportunityStates.length,
  internalProjectStates: summary.internalProjectStates.length
}, null, 2));
