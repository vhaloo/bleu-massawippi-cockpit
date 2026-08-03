import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HELP = `
Synchronisation et export d’audit du Cockpit Communication Bleu

Usage :
  node admin_sync.js [--days=N] [--read-cap=N] [--page-size=N]
  node admin_sync.js --target=collection/id[,collection/id...] [--read-cap=N]
  node admin_sync.js --media-reconcile=eventId,mediaId [--read-cap=N]
  node admin_sync.js --audit-export
  node admin_sync.js --help

Modes :
  mode quotidien (défaut)
             Lit seulement les deltas après le checkpoint local. Le premier passage
             utilise --days comme fenêtre initiale, puis le checkpoint prévaut.
  --target=S Lecture directe, bornée et sans écriture des documents indiqués.
  --media-reconcile=E,M
             Rapport ciblé et sans écriture pour un événement, un média et leurs
             tâches de validation. Ne modifie aucun checkpoint quotidien.
  --audit-export
             Export logique assaini et horodaté de toutes les collections de premier
             niveau. C’est le seul mode qui effectue volontairement un audit complet.

Options quotidiennes :
  --days=N   Fenêtre initiale seulement (1 à 366, défaut : 14).
  --read-cap=N
             Plafond dur estimé de lectures de documents (12 à 5000, défaut : 500).
  --page-size=N
             Taille maximale d’une page Firestore (1 à 200, défaut : 100).
  --overlap-seconds=N
             Chevauchement anti-retard (0 à 900, défaut : 120), dédupliqué localement.
  --output=P Sous-dossier de sortie sous cockpit/sync-output.

Compatibilité :
  --full     Alias historique de --audit-export; ce n’est pas une sauvegarde de reprise.
  --help     Affiche cette aide sans exiger de connexion ni de clé Firebase.

Authentification :
  Définir GOOGLE_APPLICATION_CREDENTIALS vers une clé de compte de service locale.
  La clé et les variables d’environnement ne sont jamais copiées dans les sorties.
`;

const DEFAULT_READ_CAP = 500;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_OVERLAP_SECONDS = 120;
const MAX_TARGETS = 20;
const LOCK_STALE_MS = 6 * 60 * 60 * 1000;

const SYNC_COLLECTIONS = [
  { name: "scheduleItems", timestampField: "updatedAt" },
  { name: "comments", timestampField: "updatedAt" },
  { name: "auditLogs", timestampField: "createdAt" },
  { name: "cockpitFeedback", timestampField: "updatedAt" },
  { name: "tasks", timestampField: "updatedAt" },
  { name: "actionItems", timestampField: "updatedAt" },
  { name: "changeArchive", timestampField: "createdAt" },
  { name: "privateContentVersions", timestampField: "createdAt" },
  { name: "mediaLinks", timestampField: "updatedAt" },
  { name: "mediaDecisions", timestampField: "updatedAt" },
  { name: "workflowStates", timestampField: "updatedAt" },
  { name: "editorialDecisions", timestampField: "updatedAt" },
  { name: "opportunityStates", timestampField: "updatedAt" },
  { name: "internalProjectStates", timestampField: "updatedAt" },
  { name: "projectEventProposals", timestampField: "updatedAt" },
  { name: "projectCalendarEvents", timestampField: "updatedAt" }
];

const BUSINESS_COLLECTIONS = [
  "actionItems",
  "attachments",
  "auditLogs",
  "changeArchive",
  "cockpitFeedback",
  "comments",
  "editorialDecisions",
  "eventSummaries",
  "internalProjectStates",
  "mediaLinks",
  "mediaDecisions",
  "opportunityStates",
  "projectCalendarEvents",
  "projectEventProposals",
  "privateConfig",
  "privateContent",
  "privateContentVersions",
  "scheduleItems",
  "tasks",
  "users",
  "workflowStates"
];

const TARGET_COLLECTIONS = new Set(BUSINESS_COLLECTIONS);
const SECRET_FIELD = /(?:password|passwd|secret|private[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|session[_-]?token)/i;

class CliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) throw new CliError(`Argument inattendu : ${raw}`);
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

function integerOption(args, name, fallback, minimum, maximum) {
  const raw = args.has(name) ? Number(args.get(name)) : fallback;
  if (!Number.isInteger(raw) || raw < minimum || raw > maximum) {
    throw new CliError(`--${name} doit être un nombre entier entre ${minimum} et ${maximum}.`);
  }
  return raw;
}

export function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && value.__firestoreType === "timestamp") return dateValue(value.value);
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

export function normalizeFirestoreValue(value, logicalPath = "", redactions = []) {
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

function stableFingerprint(value) {
  const redactions = [];
  return sha256(JSON.stringify(normalizeFirestoreValue(value, "", redactions)));
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Le fichier local ${filePath} est illisible : ${error?.message || error}`);
  }
}

export async function atomicWriteJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  let handle;
  try {
    handle = await fs.open(temporary, "wx");
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporary, filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
  return { bytes: Buffer.byteLength(content, "utf8"), sha256: sha256(content) };
}

async function writeJsonExclusive(root, relativePath, payload) {
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const absolutePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, { encoding: "utf8", flag: "wx" });
  return {
    path: relativePath.split(path.sep).join("/"),
    bytes: Buffer.byteLength(content, "utf8"),
    sha256: sha256(content)
  };
}

function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

export async function acquireLock(lockPath, now = new Date()) {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const owner = {
    schemaVersion: 1,
    token: crypto.randomUUID(),
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: now.toISOString()
  };

  const create = async () => {
    const handle = await fs.open(lockPath, "wx");
    await handle.writeFile(`${JSON.stringify(owner, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
  };

  try {
    await create();
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readJsonIfPresent(lockPath).catch(() => null);
    const age = existing?.startedAt ? now.valueOf() - new Date(existing.startedAt).valueOf() : 0;
    const sameHost = existing?.hostname === owner.hostname;
    const definitelyStopped = sameHost && !pidIsAlive(Number(existing?.pid));
    if (!definitelyStopped || !Number.isFinite(age) || age < LOCK_STALE_MS) {
      throw new CliError("Une autre synchronisation semble déjà active. Aucun second processus n’a été lancé.", 3);
    }
    const preserved = `${lockPath}.stale-${timestampSlug(now)}-${safeFileName(existing?.token || "unknown")}`;
    await fs.rename(lockPath, preserved);
    await create();
  }

  return async () => {
    try {
      const current = await readJsonIfPresent(lockPath);
      if (current?.token === owner.token) await fs.unlink(lockPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  };
}

function effectiveProjectId(app, env) {
  return app.options.projectId || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || "unconfirmed";
}

function assertStateProject(state, projectId, label) {
  if (state?.projectId && state.projectId !== "unconfirmed" && projectId !== "unconfirmed" && state.projectId !== projectId) {
    throw new CliError(`${label} appartient au projet ${state.projectId}, pas au projet actif ${projectId}. Aucun curseur n’a été réutilisé.`, 4);
  }
}

function readRecent(collectionName) {
  const definition = SYNC_COLLECTIONS.find((entry) => entry.name === collectionName);
  if (!definition) throw new Error(`Collection quotidienne inconnue : ${collectionName}`);
  return definition;
}

function dailyDefinitions() {
  return [
    readRecent("scheduleItems"),
    readRecent("comments"),
    readRecent("auditLogs"),
    readRecent("cockpitFeedback"),
    readRecent("tasks"),
    readRecent("actionItems"),
    readRecent("changeArchive"),
    readRecent("privateContentVersions"),
    readRecent("mediaLinks"),
    readRecent("mediaDecisions"),
    readRecent("workflowStates"),
    readRecent("editorialDecisions"),
    readRecent("opportunityStates"),
    readRecent("internalProjectStates"),
    readRecent("projectEventProposals"),
    readRecent("projectCalendarEvents")
  ];
}

function makeReadBudget(limit) {
  return {
    limit,
    estimatedDocumentReads: 0,
    queryCount: 0,
    documentsFetched: 0,
    getCount: 0,
    get remaining() {
      return this.limit - this.estimatedDocumentReads;
    },
    chargeQuery(size) {
      const cost = Math.max(1, size);
      if (cost > this.remaining) throw new Error("Le plafond de lectures aurait été dépassé.");
      this.estimatedDocumentReads += cost;
      this.queryCount += 1;
      this.documentsFetched += size;
    },
    chargeGet(count = 1) {
      if (count > this.remaining) throw new Error("Le plafond de lectures aurait été dépassé.");
      this.estimatedDocumentReads += count;
      this.getCount += count;
      this.documentsFetched += count;
    }
  };
}

function checkpointFingerprintMap(collectionState) {
  const map = new Map();
  for (const entry of collectionState?.recentDocuments || []) {
    if (entry?.id && entry?.timestamp && entry?.fingerprint) map.set(`${entry.id}\u0000${entry.timestamp}`, entry.fingerprint);
  }
  return map;
}

function rawDocument(document) {
  return { id: document.id, ...document.data() };
}

export async function readIncrementalCollections({
  db,
  FieldPath,
  definitions,
  checkpoint,
  baselineDate,
  upperBound,
  overlapSeconds,
  pageSize,
  readCap
}) {
  const budget = makeReadBudget(readCap);
  const rowsByCollection = Object.fromEntries(definitions.map(({ name }) => [name, []]));
  const states = definitions.map((definition) => {
    const previous = checkpoint?.collections?.[definition.name] || null;
    const cursorDate = dateValue(previous?.cursor?.timestamp);
    const resumeCursor = previous?.exhausted === false
      && previous?.cursor?.kind === "document"
      && cursorDate
      && typeof previous.cursor.id === "string"
      ? { timestamp: cursorDate, id: previous.cursor.id }
      : null;
    const lowerBound = cursorDate
      ? new Date(Math.max(baselineDate.valueOf(), cursorDate.valueOf() - overlapSeconds * 1000))
      : baselineDate;
    return {
      ...definition,
      previous,
      lowerBound,
      // Une collecte interrompue par le plafond doit reprendre après le dernier
      // document lu. Le chevauchement ne recommence qu'une fois la borne atteinte.
      continuation: resumeCursor,
      lastReturned: null,
      queried: false,
      exhausted: false,
      hasMore: true,
      previousFingerprints: checkpointFingerprintMap(previous),
      recentDocuments: new Map()
    };
  });

  let active = states;
  let firstRound = true;
  while (active.length && budget.remaining > 0) {
    const nextActive = [];
    for (let index = 0; index < active.length; index += 1) {
      const state = active[index];
      const reserveForFirstQueries = firstRound ? active.length - index - 1 : 0;
      const available = budget.remaining - reserveForFirstQueries;
      if (available < 1) {
        nextActive.push(state, ...active.slice(index + 1));
        break;
      }
      const limit = Math.min(pageSize, available);
      let query = db.collection(state.name)
        .where(state.timestampField, ">=", state.lowerBound)
        .where(state.timestampField, "<=", upperBound)
        .orderBy(state.timestampField, "asc")
        .orderBy(FieldPath.documentId(), "asc");
      if (state.continuation) {
        query = query.startAfter(state.continuation.timestamp, state.continuation.id);
      }
      const snapshot = await query.limit(limit).get();
      budget.chargeQuery(snapshot.size);
      state.queried = true;

      for (const document of snapshot.docs) {
        const data = document.data();
        const timestamp = dateValue(data[state.timestampField]);
        if (!timestamp) continue;
        const timestampIso = timestamp.toISOString();
        const fingerprint = stableFingerprint(data);
        const key = `${document.id}\u0000${timestampIso}`;
        state.recentDocuments.set(key, { id: document.id, timestamp: timestampIso, fingerprint });
        if (state.previousFingerprints.get(key) !== fingerprint) rowsByCollection[state.name].push(rawDocument(document));
        state.lastReturned = { timestamp, id: document.id };
      }

      if (snapshot.size < limit) {
        state.exhausted = true;
        state.hasMore = false;
      } else if (state.lastReturned) {
        state.continuation = state.lastReturned;
        nextActive.push(state);
      } else {
        state.exhausted = true;
        state.hasMore = false;
      }
    }
    active = nextActive;
    firstRound = false;
  }

  const pruneBefore = new Date(upperBound.valueOf() - overlapSeconds * 1000).toISOString();
  const collectionCheckpoints = {};
  for (const state of states) {
    const retained = new Map();
    for (const entry of state.previous?.recentDocuments || []) {
      if (entry?.timestamp >= pruneBefore) retained.set(`${entry.id}\u0000${entry.timestamp}`, entry);
    }
    for (const [key, entry] of state.recentDocuments) {
      if (entry.timestamp >= pruneBefore) retained.set(key, entry);
    }
    const cursor = state.exhausted
      ? { timestamp: upperBound.toISOString(), id: "", kind: "scan-boundary" }
      : state.lastReturned
        ? { timestamp: state.lastReturned.timestamp.toISOString(), id: state.lastReturned.id, kind: "document" }
        : state.previous?.cursor || null;
    collectionCheckpoints[state.name] = {
      timestampField: state.timestampField,
      cursor,
      caughtUpThrough: state.exhausted ? upperBound.toISOString() : state.previous?.caughtUpThrough || null,
      exhausted: state.exhausted,
      recentDocuments: [...retained.values()]
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id))
        .slice(-500)
    };
  }

  return {
    rowsByCollection,
    collectionCheckpoints,
    complete: states.every((state) => state.exhausted),
    pendingCollections: states.filter((state) => !state.exhausted).map((state) => state.name),
    metrics: {
      readCap: budget.limit,
      estimatedDocumentReads: budget.estimatedDocumentReads,
      queryCount: budget.queryCount,
      documentsFetched: budget.documentsFetched,
      documentsEmitted: Object.values(rowsByCollection).reduce((total, rows) => total + rows.length, 0),
      indexEntryReads: "not measured by this local counter"
    }
  };
}

function mapScheduleItem(row) {
  return {
    id: row.id,
    title: row.title || null,
    dateKey: row.dateKey || null,
    dateIso: row.dateIso || null,
    tasksValentin: Array.isArray(row.tasksValentin) ? row.tasksValentin : [],
    tasksAnnie: Array.isArray(row.tasksAnnie) ? row.tasksAnnie : [],
    calendarTime: row.calendarTime || null,
    calendarDurationMinutes: row.calendarDurationMinutes || null,
    calendarLocation: row.calendarLocation || null,
    calendarCost: row.calendarCost || null,
    status: row.status || "pending",
    deleted: row.deleted === true,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  };
}

function mapComment(row) {
  return {
    id: row.id,
    sectionId: row.sectionId || null,
    dictated: row.dictated === true,
    quickTag: row.quickTag || null,
    comment: row.comment || "",
    resolved: row.resolved === true,
    resolvedByLabel: row.resolvedByLabel || null,
    authorLabel: row.authorLabel || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  };
}

function mapFeedback(row) {
  return {
    id: row.id,
    sectionId: row.sectionId || null,
    category: row.category || "recommendation",
    status: row.status || "open",
    message: row.message || "",
    authorLabel: row.authorLabel || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  };
}

function mapTask(row) {
  return {
    id: row.id,
    title: row.title || null,
    status: row.status || "pending",
    targetType: row.targetType || null,
    targetId: row.targetId || null,
    targetLabel: row.targetLabel || null,
    message: row.message || "",
    createdByLabel: row.createdByLabel || null,
    assigneeUid: row.assigneeUid || null,
    assigneeRole: row.assigneeRole || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  };
}

function mapActionItem(row) {
  return {
    id: row.id,
    state: row.state || row.status || "pending",
    title: row.title || null,
    message: row.message || "",
    assigneeUid: row.assigneeUid || null,
    assigneeRole: row.assigneeRole || null,
    sourceType: row.sourceType || row.targetType || null,
    sourceId: row.sourceId || row.targetId || null,
    eventDateIso: row.eventDateIso || null,
    actionType: row.actionType || null,
    priorityKey: row.priorityKey || null,
    createdByUid: row.createdByUid || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  };
}

function mapProjectEventProposal(row) {
  return {
    id: row.id,
    title: row.title || null,
    description: row.description || "",
    startDate: row.startDate || null,
    endDate: row.endDate || row.startDate || null,
    dateMode: row.dateMode || "single",
    category: row.category || "internal_project",
    urgency: row.urgency || "normal",
    projectId: row.projectId || null,
    attachmentUrl: row.attachmentUrl || null,
    attachmentLocation: row.attachmentLocation || null,
    notes: row.notes || "",
    status: row.status || "submitted",
    convertedEventId: row.convertedEventId || null,
    authorLabel: row.authorLabel || null,
    authorRole: row.authorRole || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  };
}

function mapProjectCalendarEvent(row) {
  return {
    id: row.id,
    eventId: row.eventId || row.id,
    title: row.title || null,
    summary: row.summary || "",
    startDate: row.startDate || null,
    endDate: row.endDate || row.startDate || null,
    startTime: row.startTime || null,
    endTime: row.endTime || null,
    category: row.category || "internal_project",
    urgency: row.urgency || "normal",
    stage: row.stage || "planned",
    projectId: row.projectId || null,
    sourceProposalId: row.sourceProposalId || null,
    attachmentUrl: row.attachmentUrl || null,
    attachmentLabel: row.attachmentLabel || null,
    actionUrl: row.actionUrl || null,
    actionLabel: row.actionLabel || null,
    location: row.location || null,
    ownerLabel: row.ownerLabel || null,
    updatedByLabel: row.updatedByLabel || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null,
    updatedAt: dateValue(row.updatedAt)?.toISOString() || null
  };
}

export function buildSummary(rowsByCollection, metadata) {
  const scheduleItems = rowsByCollection.scheduleItems || [];
  const comments = rowsByCollection.comments || [];
  const logs = rowsByCollection.auditLogs || [];
  const feedback = rowsByCollection.cockpitFeedback || [];
  const tasks = rowsByCollection.tasks || [];
  const actionItems = rowsByCollection.actionItems || [];
  const changeArchive = rowsByCollection.changeArchive || [];
  const contentVersions = rowsByCollection.privateContentVersions || [];
  const mediaLinks = rowsByCollection.mediaLinks || [];
  const mediaDecisions = rowsByCollection.mediaDecisions || [];
  const workflowStates = rowsByCollection.workflowStates || [];
  const editorialDecisions = rowsByCollection.editorialDecisions || [];
  const opportunityStates = rowsByCollection.opportunityStates || [];
  const internalProjectStates = rowsByCollection.internalProjectStates || [];
  const projectEventProposals = rowsByCollection.projectEventProposals || [];
  const projectCalendarEvents = rowsByCollection.projectCalendarEvents || [];
  const changedScheduleItems = scheduleItems.filter((row) => row.deleted === true || ["approved", "needs_work", "pending", "deleted"].includes(row.status));
  const dictatedComments = comments.filter((row) => row.dictated === true).map((row) => ({
    id: row.id,
    sectionId: row.sectionId || null,
    comment: row.comment || "",
    quickTag: row.quickTag || null,
    createdAt: dateValue(row.createdAt)?.toISOString() || null
  }));

  return {
    schemaVersion: 2,
    mode: "incremental",
    generatedAt: metadata.generatedAt,
    since: metadata.since,
    baselineOnlyOnFirstRun: true,
    checkpoint: metadata.checkpoint,
    metrics: metadata.metrics,
    scheduleItems: changedScheduleItems.map(mapScheduleItem),
    comments: comments.map(mapComment),
    dictatedComments,
    auditLogs: logs.map((row) => ({ id: row.id, action: row.action || null, sectionId: row.sectionId || null, userUid: row.userUid || null, createdAt: dateValue(row.createdAt)?.toISOString() || null })),
    cockpitFeedback: feedback.map(mapFeedback),
    tasks: tasks.map(mapTask),
    actionItems: actionItems.map(mapActionItem),
    changeArchive: changeArchive.map((row) => ({ id: row.id, entityType: row.entityType || null, entityId: row.entityId || null, action: row.action || null, before: row.before || {}, after: row.after || {}, actorLabel: row.actorLabel || null, createdAt: dateValue(row.createdAt)?.toISOString() || null })),
    privateContentVersions: contentVersions.map((row) => ({ id: row.id, contentHash: row.contentHash || null, source: row.source || null, createdAt: dateValue(row.createdAt)?.toISOString() || null, bytes: Buffer.byteLength(JSON.stringify({ css: row.css || "", html: row.html || "", script: row.script || "" }), "utf8") })),
    mediaLinks: mediaLinks.map((row) => ({ id: row.id, eventId: row.eventId || null, label: row.label || null, url: row.url || null, kind: row.kind || "other", stage: row.stage || "reference", note: row.note || "", archived: row.archived === true, selectedFinal: row.selectedFinal === true, approvedBy: row.approvedBy || null, authorLabel: row.authorLabel || null, createdAt: dateValue(row.createdAt)?.toISOString() || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null })),
    mediaDecisions: mediaDecisions.map((row) => ({
      id: row.id,
      eventId: row.eventId || row.id,
      schemaVersion: Number(row.schemaVersion || 1),
      communications: normalizeFirestoreValue(row.communications || {}, `mediaDecisions/${row.id}.communications`, []),
      direction: normalizeFirestoreValue(row.direction || {}, `mediaDecisions/${row.id}.direction`, []),
      override: normalizeFirestoreValue(row.override || {}, `mediaDecisions/${row.id}.override`, []),
      agreement: normalizeFirestoreValue(row.agreement || {}, `mediaDecisions/${row.id}.agreement`, []),
      textGateStage: row.textGateStage || "proposal",
      lastMutationId: row.lastMutationId || null,
      updatedByLabel: row.updatedByLabel || null,
      updatedAt: dateValue(row.updatedAt)?.toISOString() || null
    })),
    workflowStates: workflowStates.map((row) => ({ id: row.id, eventId: row.eventId || row.id, stage: row.stage || "proposal", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null })),
    editorialDecisions: editorialDecisions.map((row) => ({ id: row.id, eventId: row.eventId || row.id, decision: row.decision || "undecided", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null })),
    opportunityStates: opportunityStates.map((row) => ({ id: row.id, opportunityId: row.opportunityId || row.id, stage: row.stage || "watch", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null })),
    internalProjectStates: internalProjectStates.map((row) => ({ id: row.id, projectId: row.projectId || row.id, stage: row.stage || "to_frame", updatedByLabel: row.updatedByLabel || null, updatedAt: dateValue(row.updatedAt)?.toISOString() || null })),
    projectEventProposals: projectEventProposals.map(mapProjectEventProposal),
    projectCalendarEvents: projectCalendarEvents.map(mapProjectCalendarEvent)
  };
}

function activeTask(row) {
  return row.deleted !== true && !["done", "completed", "resolved", "archived", "deleted", "cancelled"].includes(String(row.status || "pending").toLowerCase());
}

function activeActionItem(row) {
  return row.deleted !== true && String(row.state || row.status || "pending").toLowerCase() === "pending";
}

function activeComment(row) {
  return row.deleted !== true && row.archived !== true && row.resolved !== true;
}

function activeFeedback(row) {
  return row.deleted !== true && !["done", "completed", "resolved", "closed", "archived", "deleted"].includes(String(row.status || "open").toLowerCase());
}

function activeProjectEventProposal(row) {
  return row.deleted !== true && ["submitted", "in_review"].includes(String(row.status || "submitted").toLowerCase());
}

function activeProjectCalendarEvent(row) {
  return row.deleted !== true && !["completed", "cancelled"].includes(String(row.stage || "planned").toLowerCase());
}

function mergeActive(previousRows, deltaRows, isActive, mapper) {
  const byId = new Map((Array.isArray(previousRows) ? previousRows : []).map((row) => [row.id, row]));
  for (const row of deltaRows) {
    if (isActive(row)) byId.set(row.id, mapper(row));
    else byId.delete(row.id);
  }
  return [...byId.values()].sort((left, right) => {
    const leftTime = left.updatedAt || left.createdAt || "";
    const rightTime = right.updatedAt || right.createdAt || "";
    return rightTime.localeCompare(leftTime) || left.id.localeCompare(right.id);
  });
}

export function updateActiveMirror(previous, rowsByCollection, { projectId, generatedAt, coverageStart }) {
  const safePrevious = previous?.schemaVersion === 2 ? previous : null;
  return {
    schemaVersion: 2,
    projectId,
    generatedAt,
    coverage: {
      startedAt: safePrevious?.coverage?.startedAt || coverageStart,
      completeHistoricalCoverage: false,
      note: "Miroir actif construit par deltas; utiliser --audit-export pour un audit historique explicite."
    },
    active: {
      tasks: mergeActive(safePrevious?.active?.tasks, rowsByCollection.tasks || [], activeTask, mapTask),
      actionItems: mergeActive(safePrevious?.active?.actionItems, rowsByCollection.actionItems || [], activeActionItem, mapActionItem),
      comments: mergeActive(safePrevious?.active?.comments, rowsByCollection.comments || [], activeComment, mapComment),
      cockpitFeedback: mergeActive(safePrevious?.active?.cockpitFeedback, rowsByCollection.cockpitFeedback || [], activeFeedback, mapFeedback),
      projectEventProposals: mergeActive(safePrevious?.active?.projectEventProposals, rowsByCollection.projectEventProposals || [], activeProjectEventProposal, mapProjectEventProposal),
      projectCalendarEvents: mergeActive(safePrevious?.active?.projectCalendarEvents, rowsByCollection.projectCalendarEvents || [], activeProjectCalendarEvent, mapProjectCalendarEvent)
    }
  };
}

async function createRunDirectory(outputDir, prefix) {
  const stateDir = path.join(outputDir, ".admin-sync");
  const runsDir = path.join(stateDir, "runs");
  await fs.mkdir(runsDir, { recursive: true });
  const token = crypto.randomUUID();
  const temporary = path.join(runsDir, `.tmp-${prefix}-${token}`);
  const final = path.join(runsDir, `${prefix}-${token.slice(0, 8)}`);
  await fs.mkdir(temporary, { recursive: false });
  return { temporary, final, stateDir };
}

async function finalizeRunDirectory(run, files, metadata) {
  const manifest = {
    schemaVersion: 1,
    algorithm: "SHA-256",
    generatedAt: metadata.generatedAt,
    mode: metadata.mode,
    files: [...files].sort((left, right) => left.path.localeCompare(right.path))
  };
  const manifestFile = await writeJsonExclusive(run.temporary, "manifest.json", manifest);
  await writeJsonExclusive(run.temporary, "RUN_COMPLETE.json", {
    schemaVersion: 1,
    status: "complete",
    completedAt: new Date().toISOString(),
    manifestSha256: manifestFile.sha256
  });
  await fs.rename(run.temporary, run.final);
  return { manifest, manifestFile };
}

async function runIncrementalSync({ db, FieldPath, app, env, outputDir, days, readCap, pageSize, overlapSeconds }) {
  const generatedAt = new Date();
  const projectId = effectiveProjectId(app, env);
  const checkpointPath = path.join(outputDir, ".admin-sync", "checkpoint.json");
  const mirrorPath = path.join(outputDir, "sync-mirror.json");
  const previousCheckpoint = await readJsonIfPresent(checkpointPath);
  const previousMirror = await readJsonIfPresent(mirrorPath);
  assertStateProject(previousCheckpoint, projectId, "Le checkpoint");
  assertStateProject(previousMirror, projectId, "Le miroir");
  const baselineDate = previousCheckpoint?.baselineStartedAt
    ? new Date(previousCheckpoint.baselineStartedAt)
    : new Date(generatedAt.valueOf() - days * 24 * 60 * 60 * 1000);
  if (Number.isNaN(baselineDate.valueOf())) throw new CliError("Le checkpoint contient une date initiale invalide.", 4);

  const incremental = await readIncrementalCollections({
    db,
    FieldPath,
    definitions: dailyDefinitions(),
    checkpoint: previousCheckpoint,
    baselineDate,
    upperBound: generatedAt,
    overlapSeconds,
    pageSize,
    readCap
  });
  const checkpoint = {
    schemaVersion: 2,
    projectId,
    databaseId: "(default)",
    baselineStartedAt: baselineDate.toISOString(),
    updatedAt: generatedAt.toISOString(),
    overlapSeconds,
    completeThroughRunBoundary: incremental.complete,
    pendingCollections: incremental.pendingCollections,
    collections: incremental.collectionCheckpoints
  };
  const summary = buildSummary(incremental.rowsByCollection, {
    generatedAt: generatedAt.toISOString(),
    since: baselineDate.toISOString(),
    checkpoint: {
      previousUpdatedAt: previousCheckpoint?.updatedAt || null,
      currentUpdatedAt: checkpoint.updatedAt,
      completeThroughRunBoundary: incremental.complete,
      pendingCollections: incremental.pendingCollections
    },
    metrics: incremental.metrics
  });
  const mirror = updateActiveMirror(previousMirror, incremental.rowsByCollection, {
    projectId,
    generatedAt: generatedAt.toISOString(),
    coverageStart: baselineDate.toISOString()
  });

  const run = await createRunDirectory(outputDir, `run-${timestampSlug(generatedAt)}`);
  try {
    const files = [
      await writeJsonExclusive(run.temporary, "sync-summary.json", summary),
      await writeJsonExclusive(run.temporary, "sync-mirror.json", mirror),
      await writeJsonExclusive(run.temporary, "checkpoint.next.json", checkpoint)
    ];
    const finalized = await finalizeRunDirectory(run, files, { generatedAt: generatedAt.toISOString(), mode: "incremental" });
    await atomicWriteJson(path.join(outputDir, "sync-summary.json"), summary);
    await atomicWriteJson(mirrorPath, mirror);
    await atomicWriteJson(path.join(outputDir, "sync-manifest.json"), finalized.manifest);
    await atomicWriteJson(path.join(outputDir, "latest-run.json"), {
      schemaVersion: 1,
      mode: "incremental",
      generatedAt: generatedAt.toISOString(),
      runDirectory: path.relative(outputDir, run.final).split(path.sep).join("/"),
      completeThroughRunBoundary: incremental.complete
    });
    await atomicWriteJson(checkpointPath, checkpoint);
  } catch (error) {
    await fs.rename(run.temporary, `${run.temporary}.incomplete`).catch(() => {});
    throw error;
  }

  console.log(JSON.stringify({
    mode: "incremental",
    outputFile: path.join(outputDir, "sync-summary.json"),
    mirrorFile: mirrorPath,
    checkpointFile: checkpointPath,
    estimatedDocumentReads: incremental.metrics.estimatedDocumentReads,
    readCap,
    queryCount: incremental.metrics.queryCount,
    documentsFetched: incremental.metrics.documentsFetched,
    documentsEmitted: incremental.metrics.documentsEmitted,
    completeThroughRunBoundary: incremental.complete,
    pendingCollections: incremental.pendingCollections,
    scheduleItems: summary.scheduleItems.length,
    comments: summary.comments.length,
    dictatedComments: summary.dictatedComments.length,
    cockpitFeedback: summary.cockpitFeedback.length,
    tasks: summary.tasks.length,
    actionItems: summary.actionItems.length,
    changeArchive: summary.changeArchive.length,
    privateContentVersions: summary.privateContentVersions.length,
    mediaLinks: summary.mediaLinks.length,
    mediaDecisions: summary.mediaDecisions.length,
    workflowStates: summary.workflowStates.length,
    editorialDecisions: summary.editorialDecisions.length,
    opportunityStates: summary.opportunityStates.length,
    internalProjectStates: summary.internalProjectStates.length
  }, null, 2));
}

export function parseTargetSpecs(raw) {
  if (!raw) return [];
  const specs = String(raw).split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const separator = entry.indexOf("/");
    if (separator <= 0 || separator === entry.length - 1) throw new CliError(`Cible invalide : ${entry}. Utiliser collection/id.`);
    const collection = entry.slice(0, separator);
    const id = decodeURIComponent(entry.slice(separator + 1));
    if (!TARGET_COLLECTIONS.has(collection) || id.includes("/")) throw new CliError(`Cible non permise : ${entry}.`);
    return { collection, id };
  });
  if (specs.length > MAX_TARGETS) throw new CliError(`--target accepte au maximum ${MAX_TARGETS} documents.`);
  return specs;
}

async function queryTargetTasks(db, FieldPath, collection, field, eventId, limit, budget) {
  if (budget.remaining < 1) return [];
  const safeLimit = Math.min(limit, budget.remaining);
  const snapshot = await db.collection(collection)
    .where(field, "==", eventId)
    .orderBy(FieldPath.documentId(), "asc")
    .limit(safeLimit)
    .get();
  budget.chargeQuery(snapshot.size);
  return snapshot.docs.map(rawDocument);
}

async function runTargetRead({ db, FieldPath, app, env, outputDir, readCap, targets, mediaReconcile }) {
  const generatedAt = new Date();
  const budget = makeReadBudget(readCap);
  const redactions = [];
  const projectId = effectiveProjectId(app, env);
  const requested = [...targets];
  let reconciliation = null;
  if (mediaReconcile) {
    const [eventId, mediaId, extra] = mediaReconcile.split(",").map((entry) => entry?.trim());
    if (!eventId || !mediaId || extra) throw new CliError("--media-reconcile exige exactement eventId,mediaId.");
    if (eventId.includes("/") || mediaId.includes("/")) throw new CliError("Les identifiants de --media-reconcile ne doivent pas contenir de barre oblique.");
    requested.push(
      { collection: "scheduleItems", id: eventId },
      { collection: "mediaLinks", id: mediaId },
      { collection: "mediaDecisions", id: eventId },
      { collection: "workflowStates", id: eventId },
      { collection: "editorialDecisions", id: eventId }
    );
    reconciliation = { eventId, mediaId };
  }
  const unique = [...new Map(requested.map((entry) => [`${entry.collection}/${entry.id}`, entry])).values()];
  if (unique.length > MAX_TARGETS) throw new CliError(`Le mode ciblé accepte au maximum ${MAX_TARGETS} documents directs.`);
  if (unique.length > readCap) throw new CliError(`Les ${unique.length} lectures directes dépassent --read-cap=${readCap}.`);
  const references = unique.map(({ collection, id }) => db.collection(collection).doc(id));
  const snapshots = references.length ? await db.getAll(...references) : [];
  budget.chargeGet(snapshots.length);
  const documents = snapshots.map((snapshot, index) => ({
    collection: unique[index].collection,
    id: unique[index].id,
    exists: snapshot.exists,
    data: snapshot.exists ? normalizeFirestoreValue(snapshot.data(), snapshot.ref.path, redactions) : null
  }));

  let taskRows = [];
  let actionRows = [];
  if (reconciliation) {
    taskRows = await queryTargetTasks(db, FieldPath, "tasks", "targetId", reconciliation.eventId, 10, budget);
    actionRows = await queryTargetTasks(db, FieldPath, "actionItems", "sourceId", reconciliation.eventId, 10, budget);
  }
  const report = {
    schemaVersion: 1,
    mode: reconciliation ? "media-reconciliation-read-only" : "target-read-only",
    generatedAt: generatedAt.toISOString(),
    projectId,
    readOnly: true,
    productionWrites: 0,
    checkpointAdvanced: false,
    metrics: {
      readCap,
      estimatedDocumentReads: budget.estimatedDocumentReads,
      getCount: budget.getCount,
      queryCount: budget.queryCount,
      indexEntryReads: "not measured by this local counter"
    },
    requested: unique,
    documents,
    reconciliation: reconciliation ? {
      ...reconciliation,
      tasks: taskRows.map((row) => normalizeFirestoreValue(row, `tasks/${row.id}`, redactions)),
      actionItems: actionRows.map((row) => normalizeFirestoreValue(row, `actionItems/${row.id}`, redactions)),
      interpretation: "Rapport factuel seulement : aucune recommandation ou approbation n’est attribuée automatiquement."
    } : null,
    redactionCount: redactions.length,
    redactedFieldPaths: redactions
  };

  const run = await createRunDirectory(outputDir, `target-${timestampSlug(generatedAt)}`);
  try {
    const files = [await writeJsonExclusive(run.temporary, "target-summary.json", report)];
    const finalized = await finalizeRunDirectory(run, files, { generatedAt: generatedAt.toISOString(), mode: report.mode });
    await atomicWriteJson(path.join(outputDir, "target-summary.json"), report);
    await atomicWriteJson(path.join(outputDir, "target-manifest.json"), finalized.manifest);
  } catch (error) {
    await fs.rename(run.temporary, `${run.temporary}.incomplete`).catch(() => {});
    throw error;
  }
  console.log(JSON.stringify({
    mode: report.mode,
    outputFile: path.join(outputDir, "target-summary.json"),
    estimatedDocumentReads: budget.estimatedDocumentReads,
    readCap,
    productionWrites: 0,
    checkpointAdvanced: false
  }, null, 2));
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
  throw new Error("Impossible de créer un dossier d’export unique.");
}

async function runAuditExport({ db, app, env, syncOutputRoot }) {
  const generatedAt = new Date();
  const backupDir = await createUniqueDirectory(syncOutputRoot, `backup-${timestampSlug(generatedAt)}`);
  const inProgressPath = path.join(backupDir, "EXPORT_IN_PROGRESS.json");
  await fs.writeFile(inProgressPath, `${JSON.stringify({
    schemaVersion: 1,
    status: "in-progress",
    generatedAt: generatedAt.toISOString(),
    projectId: effectiveProjectId(app, env),
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
      const file = await writeJsonExclusive(backupDir, relativePath, {
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
      projectId: effectiveProjectId(app, env),
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
    files.push(await writeJsonExclusive(backupDir, "backup-summary.json", summary));
    const manifest = { schemaVersion: 1, algorithm: "SHA-256", generatedAt: generatedAt.toISOString(), files: [...files].sort((left, right) => left.path.localeCompare(right.path)) };
    const manifestFile = await writeJsonExclusive(backupDir, "manifest.json", manifest);
    await fs.writeFile(path.join(backupDir, "manifest.sha256"), `${manifestFile.sha256}  manifest.json\n`, { encoding: "utf8", flag: "wx" });
    await fs.writeFile(path.join(backupDir, "EXPORT_COMPLETE.json"), `${JSON.stringify({ schemaVersion: 1, status: "complete", completedAt: new Date().toISOString(), manifestSha256: manifestFile.sha256 }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fs.unlink(inProgressPath);
    console.log(JSON.stringify({ mode: "audit-export", backupDir, generatedAt: generatedAt.toISOString(), collections: summary.collectionCount, documents: summary.documentCount, redactedFields: summary.redactionCount, manifest: path.join(backupDir, "manifest.json"), manifestSha256: manifestFile.sha256 }, null, 2));
  } catch (error) {
    await fs.writeFile(path.join(backupDir, "EXPORT_INCOMPLETE.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), status: "incomplete", message: sanitizedErrorMessage(error, env) }, null, 2)}\n`, "utf8");
    throw error;
  }
}

function sanitizedErrorMessage(error, env) {
  let message = String(error?.message || error || "Erreur inconnue");
  const credentialPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialPath) message = message.split(credentialPath).join("[CREDENTIAL_PATH]");
  return message.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.has("help") || args.has("h")) {
    console.log(HELP.trim());
    return;
  }
  const allowedArgs = new Set(["days", "read-cap", "page-size", "overlap-seconds", "audit-export", "full", "output", "target", "media-reconcile", "help", "h"]);
  const unknownArgs = [...args.keys()].filter((name) => !allowedArgs.has(name));
  if (unknownArgs.length) throw new CliError(`Option inconnue : --${unknownArgs.join(", --")}`);
  const auditMode = ["audit-export", "full"].some((name) => args.has(name) && args.get(name) !== "false");
  const targetMode = args.has("target") || args.has("media-reconcile");
  if (auditMode && (targetMode || [...["days", "read-cap", "page-size", "overlap-seconds", "output"]].some((name) => args.has(name)))) {
    throw new CliError("--audit-export/--full ne peut pas être combiné avec un autre mode ou des options quotidiennes.");
  }
  if (targetMode && [...["days", "page-size", "overlap-seconds"]].some((name) => args.has(name))) {
    throw new CliError("Le mode ciblé ne peut pas être combiné avec --days, --page-size ou --overlap-seconds.");
  }
  const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
  const syncOutputRoot = path.join(workspaceDir, "sync-output");
  const requestedOutput = args.get("output") || ".";
  const requestedOutputFromWorkspace = path.resolve(workspaceDir, requestedOutput);
  const outputDir = requestedOutputFromWorkspace === syncOutputRoot || requestedOutputFromWorkspace.startsWith(syncOutputRoot + path.sep)
    ? requestedOutputFromWorkspace
    : path.resolve(syncOutputRoot, requestedOutput);
  if (outputDir !== syncOutputRoot && !outputDir.startsWith(syncOutputRoot + path.sep)) throw new CliError("--output doit rester sous cockpit/sync-output.");
  const days = integerOption(args, "days", 14, 1, 366);
  const minimumReadCap = targetMode ? 1 : SYNC_COLLECTIONS.length;
  const readCap = integerOption(args, "read-cap", targetMode ? 25 : DEFAULT_READ_CAP, minimumReadCap, 5000);
  const pageSize = integerOption(args, "page-size", DEFAULT_PAGE_SIZE, 1, 200);
  const overlapSeconds = integerOption(args, "overlap-seconds", DEFAULT_OVERLAP_SECONDS, 0, 900);
  const targets = parseTargetSpecs(args.get("target"));
  if (args.has("target") && targets.length === 0) throw new CliError("--target exige au moins une cible collection/id.");
  if (!env.GOOGLE_APPLICATION_CREDENTIALS) throw new CliError("GOOGLE_APPLICATION_CREDENTIALS n’est pas défini. Définissez-le vers une clé locale hors dépôt.");

  await fs.mkdir(syncOutputRoot, { recursive: true });
  const releaseLock = await acquireLock(path.join(syncOutputRoot, ".admin-sync.lock"));
  try {
    const [{ applicationDefault, getApp, getApps, initializeApp }, { FieldPath, getFirestore }] = await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore")
    ]);
    const app = getApps().length ? getApp() : initializeApp({ credential: applicationDefault(), projectId: env.GOOGLE_CLOUD_PROJECT || undefined });
    const db = getFirestore(app);
    if (auditMode) {
      await runAuditExport({ db, app, env, syncOutputRoot });
    } else if (targetMode) {
      await runTargetRead({ db, FieldPath, app, env, outputDir, readCap, targets, mediaReconcile: args.get("media-reconcile") || null });
    } else {
      await runIncrementalSync({ db, FieldPath, app, env, outputDir, days, readCap, pageSize, overlapSeconds });
    }
  } finally {
    await releaseLock();
  }
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  main().catch((error) => {
    console.error(sanitizedErrorMessage(error, process.env));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  });
}
