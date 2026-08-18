import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts } from "./plan-overrides.js";
import { mergePostsWithScheduleRows } from "./publication-editor-schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860";
const database = "(default)";
const apiBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${database}`;
const applyChanges = process.argv.includes("--apply");
const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
const reasonArg = process.argv.find((arg) => arg.startsWith("--reason="));
const fromDate = (fromArg?.slice("--from=".length) || "2026-08-17").trim();
const requestedIds = idsArg
  ? [...new Set(idsArg.slice("--ids=".length).split(",").map((value) => value.trim()).filter(Boolean))]
  : [];
const reason = (reasonArg?.slice("--reason=".length) || "").trim();

if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) throw new Error("--from doit utiliser le format AAAA-MM-JJ.");
if (requestedIds.some((id) => !/^[a-z0-9-]{3,80}$/i.test(id))) throw new Error("--ids contient un identifiant invalide.");
if (applyChanges && requestedIds.length === 0) throw new Error("--apply exige une liste explicite --ids.");
if (applyChanges && reason.length < 20) throw new Error("--apply exige une raison explicite d’au moins 20 caractères.");

function decodeValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return Object.fromEntries(
    Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decodeValue(child)])
  );
  return undefined;
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Type Firestore non pris en charge : ${typeof value}`);
}

function encodeFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encodeValue(value)]));
}

function dateLabel(dateIso) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(date)
    .replace(/^./, (character) => character.toLocaleUpperCase("fr-CA"));
}

function calendarTimeFor(post) {
  if (/^\d{2}:\d{2}$/.test(String(post.calendarTime || ""))) return String(post.calendarTime);
  return ({ Lundi: "09:00", Mardi: "12:00", Mercredi: "18:00", Jeudi: "12:00", Vendredi: "17:00", Samedi: "10:00", Dimanche: "09:00" })[
    String(post.date || "").split(" ")[0]
  ] || "12:00";
}

function scheduleFields(post) {
  return {
    title: String(post.title || "").slice(0, 220),
    dateKey: String(post.date || dateLabel(post.dateIso)).slice(0, 80),
    dateIso: String(post.dateIso || "").slice(0, 10),
    format: String(post.format || "").slice(0, 220),
    role: String(post.role || "").slice(0, 5000),
    cta: String(post.cta || "").slice(0, 220),
    source: String(post.source || "").slice(0, 500),
    tasksValentin: Array.isArray(post.tasksValentin)
      ? post.tasksValentin.map((task) => String(task).slice(0, 1000)).slice(0, 8)
      : [String(post.task || "").slice(0, 1000)].filter(Boolean),
    tasksAnnie: Array.isArray(post.tasksAnnie)
      ? post.tasksAnnie.map((task) => String(task).slice(0, 1000)).slice(0, 8)
      : [],
    calendarTime: calendarTimeFor(post),
    calendarDurationMinutes: 30,
    calendarLocation: post.id === "s1d1"
      ? "Église Saint-Barthélemy, 911, rue Clough, Ayer’s Cliff, Québec J0B 1C0"
      : "En ligne — Facebook / Instagram",
    calendarCost: "Aucun coût de diffusion; confirmer les droits, la production et tout achat éventuel."
  };
}

function valueAtPath(object, fieldPath) {
  return fieldPath.split(".").reduce((value, key) => value?.[key], object);
}

function assignPath(object, fieldPath, value) {
  const keys = fieldPath.split(".");
  let cursor = object;
  keys.slice(0, -1).forEach((key) => { cursor = cursor[key] ||= {}; });
  cursor[keys.at(-1)] = value;
}

async function readSourcePosts() {
  const source = await fs.readFile(path.resolve(here, "..", "index.html"), "utf8");
  const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
  if (!postsJson) throw new Error("Le calendrier source est illisible.");
  return applyPlanOverridesToPosts(JSON.parse(postsJson));
}

async function firebaseHeaders() {
  const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const accessToken = config.tokens?.access_token;
  if (!accessToken || Number(config.tokens?.expires_at || 0) < Date.now() + 120_000) {
    throw new Error("Session Firebase CLI absente ou expirée; renouveler la session avant cette opération bornée.");
  }
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

async function listCollection(collectionName, headers) {
  const rows = [];
  let pageToken = "";
  do {
    const url = new URL(`${apiBase}/documents/${collectionName}`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Lecture ${collectionName} refusée (${response.status}).`);
    const payload = await response.json();
    (payload.documents || []).forEach((document) => rows.push({
      id: document.name.split("/").at(-1),
      name: document.name,
      updateTime: document.updateTime,
      ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decodeValue(value)]))
    }));
    pageToken = payload.nextPageToken || "";
    if (rows.length > 200) throw new Error(`${collectionName} dépasse la borne de lecture de 200 documents.`);
  } while (pageToken);
  return rows;
}

function buildAudit(posts, scheduleRows, workflowRows) {
  const expectedActive = posts.filter((post) => post.archivedEditorial !== true && post.dateIso >= fromDate);
  const expectedArchived = posts.filter((post) => post.archivedEditorial === true && post.dateIso >= fromDate);
  const rowById = new Map(scheduleRows.map((row) => [row.id, row]));
  const workflowById = new Map(workflowRows.map((row) => [row.eventId || row.id, row]));
  const mismatches = expectedActive.flatMap((post) => {
    const row = rowById.get(post.id);
    if (row?.dateIso === post.dateIso) return [];
    return [{ id: post.id, title: post.title, expected: post.dateIso, live: row?.dateIso || null, stage: workflowById.get(post.id)?.stage || "proposal" }];
  });
  const archivesMissing = expectedArchived
    .filter((post) => rowById.has(post.id) && rowById.get(post.id)?.editorial?.archivedEditorial !== true)
    .map((post) => ({ id: post.id, dateIso: post.dateIso, title: post.title }));
  const effectivePosts = mergePostsWithScheduleRows(posts, scheduleRows)
    .filter((post) => post.archivedEditorial !== true && post.dateIso >= fromDate);
  const effectiveByDate = Object.groupBy(effectivePosts, (post) => post.dateIso);
  const duplicates = Object.entries(effectiveByDate)
    .filter(([, items]) => items.length > 1)
    .map(([dateIso, items]) => ({ dateIso, ids: items.map((item) => item.id), titles: items.map((item) => item.title) }));
  return {
    expectedActive,
    expectedArchived,
    rowById,
    workflowById,
    mismatches,
    archivesMissing,
    duplicates
  };
}

function writeForDocument({ name, fields, fieldPaths, updateTime, exists }) {
  return {
    update: { name, fields: encodeFields(fields) },
    updateMask: { fieldPaths },
    currentDocument: updateTime ? { updateTime } : { exists }
  };
}

async function applySelected(posts, audit, headers) {
  const postById = new Map(posts.map((post) => [post.id, post]));
  const now = new Date().toISOString();
  const writes = [];
  const changes = [];
  for (const id of requestedIds) {
    const post = postById.get(id);
    if (!post) throw new Error(`Publication introuvable : ${id}`);
    const before = audit.rowById.get(id);
    const workflowStage = audit.workflowById.get(id)?.stage || "proposal";
    if (workflowStage === "completed") throw new Error(`Refus de déplacer ${id} : publication terminée.`);
    const fullScheduleFields = scheduleFields(post);
    const desired = post.archivedEditorial === true
      ? { "editorial.archivedEditorial": true }
      : before
        ? {
            dateKey: fullScheduleFields.dateKey,
            dateIso: fullScheduleFields.dateIso,
            calendarTime: fullScheduleFields.calendarTime
          }
        : fullScheduleFields;
    const changedPaths = Object.keys(desired).filter((fieldPath) => JSON.stringify(valueAtPath(before, fieldPath) ?? null) !== JSON.stringify(desired[fieldPath] ?? null));
    if (changedPaths.length === 0) continue;
    const afterForArchive = Object.fromEntries(changedPaths.map((fieldPath) => [fieldPath, desired[fieldPath]]));
    const beforeForArchive = Object.fromEntries(changedPaths.map((fieldPath) => [fieldPath, valueAtPath(before, fieldPath) ?? null]));
    const archiveId = `schedule-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${id.slice(0, 38)}-${crypto.randomUUID().slice(0, 6)}`;
    const archiveName = `projects/${projectId}/databases/${database}/documents/changeArchive/${archiveId}`;
    writes.push(writeForDocument({
      name: archiveName,
      fields: {
        entityType: "scheduleItem",
        entityId: id,
        action: "réconciliation cadence cinq jours distincts",
        before: beforeForArchive,
        after: afterForArchive,
        reason,
        protectedWorkflowStage: workflowStage,
        actorUid: "system_schedule_reconciliation",
        actorLabel: "Réconciliation contrôlée du calendrier",
        createdAt: now
      },
      fieldPaths: ["entityType", "entityId", "action", "before", "after", "reason", "protectedWorkflowStage", "actorUid", "actorLabel", "createdAt"],
      exists: false
    }));
    const targetName = `projects/${projectId}/databases/${database}/documents/scheduleItems/${id}`;
    if (!before) {
      const createFields = { ...desired, status: "pending", deleted: false, selected: post.choiceRequired !== true, updatedAt: now, updatedBy: "system_schedule_reconciliation" };
      writes.push(writeForDocument({ name: targetName, fields: createFields, fieldPaths: Object.keys(createFields), exists: false }));
    } else {
      const updateFields = {};
      changedPaths.forEach((fieldPath) => assignPath(updateFields, fieldPath, desired[fieldPath]));
      updateFields.updatedAt = now;
      updateFields.updatedBy = "system_schedule_reconciliation";
      writes.push(writeForDocument({ name: targetName, fields: updateFields, fieldPaths: [...changedPaths, "updatedAt", "updatedBy"], updateTime: before.updateTime }));
    }
    changes.push({ id, workflowStage, changedPaths, before: beforeForArchive, after: afterForArchive });
  }
  if (writes.length === 0) return { applied: true, writes: 0, changes: [] };
  if (writes.length > 500) throw new Error("Le lot dépasse la limite Firestore de 500 écritures.");
  const response = await fetch(`${apiBase}/documents:commit`, { method: "POST", headers, body: JSON.stringify({ writes }) });
  if (!response.ok) throw new Error(`Réconciliation refusée (${response.status}) : ${(await response.text()).slice(0, 500)}`);
  return { applied: true, writes: writes.length, changes };
}

const posts = await readSourcePosts();
const headers = await firebaseHeaders();
const [scheduleRows, workflowRows] = await Promise.all([
  listCollection("scheduleItems", headers),
  listCollection("workflowStates", headers)
]);
const audit = buildAudit(posts, scheduleRows, workflowRows);

if (!applyChanges) {
  console.log(JSON.stringify({
    mode: "check",
    projectId,
    fromDate,
    scheduleReads: scheduleRows.length,
    workflowReads: workflowRows.length,
    expectedActive: audit.expectedActive.length,
    mismatchCount: audit.mismatches.length,
    archiveMarkersMissing: audit.archivesMissing.length,
    duplicateDates: audit.duplicates,
    mismatches: audit.mismatches,
    archivesMissing: audit.archivesMissing,
    writes: 0
  }, null, 2));
  process.exitCode = audit.mismatches.length || audit.archivesMissing.length || audit.duplicates.length ? 2 : 0;
} else {
  const result = await applySelected(posts, audit, headers);
  console.log(JSON.stringify({ mode: "apply", projectId, fromDate, requestedIds, reason, ...result }, null, 2));
}
