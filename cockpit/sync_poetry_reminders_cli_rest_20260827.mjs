#!/usr/bin/env node
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts, preparePlanScript } from "./plan-overrides.js";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-poetry-reminders-cli-rest-20260827");
if (APPLY && !CONFIRM) {
  throw new Error("Relancer avec --apply --confirm-poetry-reminders-cli-rest-20260827 après le dry-run.");
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860";
const DATABASE_ID = "(default)";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
const TARGET_IDS = [
  "alt-20260714",
  "alt-20260723",
  "poesie-20260829-rappel-demain",
  "poesie-20260830-rappel-aujourdhui"
];
const REMINDERS = [
  {
    eventId: "poesie-20260829-rappel-demain",
    mediaId: "editorial-poesie-20260829-rappel-demain-v8",
    dateIso: "2026-08-29"
  },
  {
    eventId: "poesie-20260830-rappel-aujourdhui",
    mediaId: "editorial-poesie-20260830-rappel-aujourdhui-v8",
    dateIso: "2026-08-30"
  }
];

const encodeValue = (value) => {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Type Firestore non pris en charge : ${typeof value}`);
};
const encodeFields = (value) => Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encodeValue(child)]));
const decodeValue = (value = {}) => {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue?.fields || {});
  return undefined;
};
const decodeFields = (fields = {}) => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const safeId = (value) => {
  if (!/^[a-z0-9-]{3,160}$/i.test(value)) throw new Error(`Identifiant Firestore invalide : ${value}`);
  return value;
};
const documentName = (collection, id) => `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${collection}/${safeId(id)}`;
const updateWrite = ({ collection, id, data, existing, merge = true }) => {
  const fields = encodeFields(data);
  return {
    update: { name: documentName(collection, id), fields },
    ...(merge ? { updateMask: { fieldPaths: Object.keys(fields) } } : {}),
    currentDocument: existing?.exists ? { updateTime: existing.updateTime } : { exists: false }
  };
};

const execFileAsync = promisify(execFile);
const firebaseCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
const firebaseArgs = process.platform === "win32"
  ? ["/d", "/s", "/c", "npx firebase-tools@15.23.0 login:list --json"]
  : ["firebase-tools@15.23.0", "login:list", "--json"];
const { stdout: firebaseSessionOutput } = await execFileAsync(firebaseCommand, firebaseArgs, {
  windowsHide: true,
  maxBuffer: 2_000_000
});
const firebaseSessions = JSON.parse(firebaseSessionOutput)?.result || [];
const firebaseSession = firebaseSessions.find((entry) => entry?.tokens?.access_token && entry?.user?.email);
const accessToken = firebaseSession?.tokens?.access_token;
if (!accessToken || Number(firebaseSession?.tokens?.expires_at || 0) < Date.now() + 120_000) {
  throw new Error("Session Firebase CLI expirée; renouveler la session avant cette synchronisation bornée.");
}
const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

async function getDocument(collection, id) {
  const response = await fetch(`${BASE}/documents/${collection}/${safeId(id)}`, { headers });
  if (response.status === 404) return { exists: false, collection, id, data: null, updateTime: null };
  if (!response.ok) throw new Error(`Lecture refusée pour ${collection}/${id} (${response.status}).`);
  const document = await response.json();
  return { exists: true, collection, id, data: decodeFields(document.fields), updateTime: document.updateTime };
}

async function listUsers() {
  const response = await fetch(`${BASE}/documents/users?pageSize=20`, { headers });
  if (!response.ok) throw new Error(`Lecture des comptes refusée (${response.status}).`);
  const payload = await response.json();
  return (payload.documents || []).map((document) => ({
    id: document.name.split("/").pop(),
    data: decodeFields(document.fields)
  }));
}

const source = await fs.readFile(path.resolve(HERE, "..", "index.html"), "utf8");
const css = source.match(/<style>([\s\S]*?)<\/style>/i)?.[1];
const privateHtml = source.match(/<body>([\s\S]*?)<script>\s*var posts=/i)?.[1]?.trim();
const planScript = source.match(/<script>\s*(var posts=\[[\s\S]*?)<\/script>/i)?.[1];
const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
if (!css || !privateHtml || !planScript || !postsJson) throw new Error("Le calendrier source est illisible.");
const allPosts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const posts = TARGET_IDS.map((id) => {
  const post = allPosts.find((candidate) => candidate.id === id);
  if (!post) throw new Error(`Publication source introuvable : ${id}`);
  return post;
});
const manifest = JSON.parse(await fs.readFile(path.join(HERE, "editorial_media_manifest.json"), "utf8"));
const reminderMedia = REMINDERS.map((reminder) => {
  const item = manifest.find((candidate) => candidate.id === reminder.mediaId && candidate.eventId === reminder.eventId);
  if (!item) throw new Error(`Média source introuvable : ${reminder.mediaId}`);
  return item;
});

const users = await listUsers();
const admins = users.filter(({ data }) => data.role === "admin" && data.active === true);
if (admins.length !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.length}).`);
const actorUid = admins[0].id;
const actorLabel = String(admins[0].data.displayLabel || "Valentin Wittwe").slice(0, 120);
const now = new Date().toISOString();
const writes = [];
const summary = { privateContentUpdated: false, schedulesCreated: 0, schedulesMoved: 0, mediaCreated: 0, reminderStatesPrepared: 0, noOps: 0 };

const privateContent = {
  schemaVersion: 1,
  css,
  html: privateHtml,
  script: preparePlanScript(planScript, allPosts)
};
const contentHash = crypto.createHash("sha256").update(JSON.stringify(privateContent)).digest("hex");
const existingPlan = await getDocument("privateContent", "plan");
if (existingPlan.data?.contentHash !== contentHash) {
  const versionId = `content-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
  const existingVersion = { exists: false, updateTime: null };
  writes.push(updateWrite({ collection: "privateContentVersions", id: versionId, existing: existingVersion, merge: false, data: {
    ...privateContent,
    contentHash,
    source: "index.html",
    createdAt: now
  } }));
  writes.push(updateWrite({ collection: "privateContent", id: "plan", existing: existingPlan, merge: false, data: {
    ...privateContent,
    contentHash,
    updatedAt: now
  } }));
  summary.privateContentUpdated = true;
} else {
  summary.noOps += 1;
}

const scheduleData = (post) => ({
  title: String(post.title).slice(0, 220),
  dateKey: String(post.date).slice(0, 80),
  dateIso: String(post.dateIso || "").slice(0, 10),
  format: String(post.format || "").slice(0, 220),
  role: String(post.role || "").slice(0, 5000),
  cta: String(post.cta || "").slice(0, 220),
  source: String(post.source || "").slice(0, 500),
  tasksValentin: Array.isArray(post.tasksValentin) ? post.tasksValentin.map((task) => String(task).slice(0, 1000)).slice(0, 8) : [String(post.task || "").slice(0, 1000)],
  tasksAnnie: Array.isArray(post.tasksAnnie) ? post.tasksAnnie.map((task) => String(task).slice(0, 1000)).slice(0, 8) : [],
  calendarTime: /^\d{2}:\d{2}$/.test(String(post.calendarTime || "")) ? String(post.calendarTime) : "12:00",
  calendarDurationMinutes: 30,
  calendarLocation: "En ligne — Facebook / Instagram",
  calendarCost: "Aucun coût de diffusion; confirmer les droits, la production et tout achat éventuel."
});

for (const post of posts) {
  const [existing, workflow] = await Promise.all([
    getDocument("scheduleItems", post.id),
    getDocument("workflowStates", post.id)
  ]);
  const desired = scheduleData(post);
  const changed = !existing.exists || Object.entries(desired).some(([key, value]) => !same(existing.data?.[key], value));
  if (!changed) {
    summary.noOps += 1;
    continue;
  }
  const stage = String(workflow.data?.stage || "proposal").toLowerCase();
  if (existing.exists && ["scheduled", "published"].includes(stage)) {
    throw new Error(`${post.id}: déplacement refusé, car le workflow est ${stage}.`);
  }
  if (existing.exists) {
    const archiveId = `poetry-reminder-schedule-20260827-${post.id}`;
    const archive = await getDocument("changeArchive", archiveId);
    if (archive.exists) throw new Error(`${post.id}: une archive de déplacement existe déjà, mais la date finale ne correspond pas.`);
    const before = Object.fromEntries(Object.keys(desired).map((key) => [key, existing.data?.[key] ?? null]));
    writes.push(updateWrite({ collection: "changeArchive", id: archiveId, existing: archive, merge: false, data: {
      entityType: "scheduleItem",
      entityId: post.id,
      action: "déplacement pour les rappels Au bord du bleu des 29 et 30 août",
      before,
      after: desired,
      protectedWorkflowStage: stage,
      completedScheduleOverride: false,
      completedScheduleOverrideReason: null,
      actorUid,
      actorLabel,
      createdAt: now
    } }));
    writes.push(updateWrite({ collection: "scheduleItems", id: post.id, existing, data: { ...desired, updatedAt: now, updatedBy: actorUid } }));
    summary.schedulesMoved += 1;
  } else {
    writes.push(updateWrite({ collection: "scheduleItems", id: post.id, existing, merge: false, data: {
      ...desired,
      status: "pending",
      deleted: false,
      selected: post.choiceRequired !== true,
      updatedAt: now,
      updatedBy: actorUid
    } }));
    summary.schedulesCreated += 1;
  }
}

const sourceMedia = await getDocument("mediaLinks", "editorial-poesie-20260821-invitation-v8");
const sourceUrl = sourceMedia.data?.url || "";
if (!sourceMedia.exists || !/^https:\/\/bleumassawippi\.sharepoint\.com\//.test(sourceUrl)) {
  throw new Error("L’affiche V8 source n’a pas de lien SharePoint valide.");
}
for (const item of reminderMedia) {
  const existing = await getDocument("mediaLinks", item.id);
  const desired = {
    eventId: item.eventId,
    label: item.label,
    url: sourceUrl,
    kind: item.kind || "image",
    note: item.note,
    altText: item.altText,
    rightsStatus: item.rightsStatus,
    previewUrl: item.previewUrl,
    stage: item.stage || "proposal",
    publicationBlocked: item.publicationBlocked === true,
    archived: item.archived === true,
    authorUid: "system-seed",
    authorLabel: "Série éditoriale originale",
    updatedAt: now,
    updatedBy: actorUid
  };
  if (!existing.exists) {
    writes.push(updateWrite({ collection: "mediaLinks", id: item.id, existing, merge: false, data: { ...desired, createdAt: now } }));
    summary.mediaCreated += 1;
  } else {
    const stableDesired = { ...desired };
    delete stableDesired.updatedAt;
    if (Object.entries(stableDesired).some(([key, value]) => !same(existing.data?.[key], value))) {
      throw new Error(`${item.id}: un média portant cet identifiant existe déjà avec un autre contenu.`);
    }
    summary.noOps += 1;
  }
}

const emptySide = (role) => ({ status: "none", mediaIds: [], actorUid: "", actorLabel: "", actorRole: role, decidedAt: null });
const emptyOverride = () => ({ active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null });
for (const reminder of REMINDERS) {
  const [schedule, media, workflow, decision, archive] = await Promise.all([
    getDocument("scheduleItems", reminder.eventId),
    getDocument("mediaLinks", reminder.mediaId),
    getDocument("workflowStates", reminder.eventId),
    getDocument("mediaDecisions", reminder.eventId),
    getDocument("changeArchive", `poetry-reminder-20260827-${reminder.eventId}`)
  ]);
  const scheduleWillExist = schedule.exists || posts.some((post) => post.id === reminder.eventId);
  const mediaWillExist = media.exists || reminderMedia.some((item) => item.id === reminder.mediaId);
  if (!scheduleWillExist || !mediaWillExist) throw new Error(`${reminder.eventId}: contenu ou média manquant.`);
  const selectedByCommunications = decision.data?.communications?.status === "selected"
    && same(decision.data?.communications?.mediaIds, [reminder.mediaId]);
  const finalState = workflow.data?.stage === "content_review" && selectedByCommunications
    && decision.data?.agreement?.status === "pending";
  if (archive.exists) {
    if (!finalState) throw new Error(`${reminder.eventId}: archive existante, mais état final incohérent.`);
    summary.noOps += 1;
    continue;
  }
  const stage = String(workflow.data?.stage || "proposal");
  if (!["proposal", "content_review"].includes(stage)) throw new Error(`${reminder.eventId}: workflow déjà avancé (${stage}).`);
  if (decision.exists && (decision.data?.direction?.status === "selected" || decision.data?.override?.active === true)) {
    throw new Error(`${reminder.eventId}: une décision de la direction existe déjà.`);
  }
  if (decision.exists && decision.data?.communications?.status === "selected" && !selectedByCommunications) {
    throw new Error(`${reminder.eventId}: les communications ont déjà choisi un autre média.`);
  }
  const communications = {
    status: "selected",
    mediaIds: [reminder.mediaId],
    actorUid,
    actorLabel,
    actorRole: "admin",
    decidedAt: now
  };
  const workflowAfter = { eventId: reminder.eventId, stage: "content_review", updatedAt: now, updatedBy: actorUid, updatedByLabel: actorLabel };
  const decisionAfter = {
    eventId: reminder.eventId,
    schemaVersion: 2,
    communications,
    direction: decision.data?.direction || emptySide("director"),
    override: emptyOverride(),
    agreement: { status: "pending", mediaIds: [], divergent: false },
    textGateStage: "content_review",
    lastMutationId: `poetry-reminder-20260827-${reminder.eventId}`,
    updatedAt: now,
    updatedBy: actorUid,
    updatedByLabel: actorLabel
  };
  writes.push(updateWrite({ collection: "workflowStates", id: reminder.eventId, existing: workflow, data: workflowAfter }));
  writes.push(updateWrite({ collection: "mediaDecisions", id: reminder.eventId, existing: decision, merge: false, data: decisionAfter }));
  writes.push(updateWrite({ collection: "changeArchive", id: `poetry-reminder-20260827-${reminder.eventId}`, existing: archive, merge: false, data: {
    entityType: "mediaDecision",
    entityId: reminder.eventId,
    action: "rappel Au bord du bleu soumis à la direction avec l’affiche V8 retenue par les communications",
    before: { workflow: workflow.data || { eventId: reminder.eventId, stage: "proposal" }, decision: decision.data || {}, scheduleDateIso: reminder.dateIso, mediaId: reminder.mediaId },
    after: { workflow: workflowAfter, decision: decisionAfter, scheduleDateIso: reminder.dateIso, mediaId: reminder.mediaId },
    actorUid,
    actorLabel,
    createdAt: now
  } }));
  summary.reminderStatesPrepared += 1;
}

if (writes.length > 30) throw new Error(`Plafond de sécurité dépassé : ${writes.length} écritures.`);
if (APPLY && writes.length) {
  const response = await fetch(`${BASE}/documents:commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ writes })
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    throw new Error(`Transaction Firestore refusée (${response.status}) : ${detail}`);
  }
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  actor: actorLabel,
  targetIds: TARGET_IDS,
  writes: writes.length,
  maximumWrites: 30,
  summary,
  safeguards: {
    transactionAtomic: true,
    updateTimePreconditions: true,
    completedOrPublishedMoved: false,
    directionDecisionInvented: false,
    completionChanged: false,
    permissionsChanged: false,
    sourcePoster: "editorial-poesie-20260821-invitation-v8"
  },
  operationId: crypto.createHash("sha256").update(writes.map((write) => write.update.name).join("|")).digest("hex").slice(0, 16)
}, null, 2));
