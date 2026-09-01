import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-au-bord-du-bleu-closure");
if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-au-bord-du-bleu-closure après vérification du dry-run.");

const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const DATABASE = "(default)";
const INTERNAL_PROJECT_ID = "poesie-du-lac";
const EVENT_ID = "au-bord-du-bleu-evenement-20260830";
const ACTION_ID = "content-notice-internal-poetry-guide-terrain-20260828-v1";
const MUTATION_ID = "internal-project-poesie-du-lac-closure-20260901-v1";
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}`;
const root = `projects/${PROJECT_ID}/databases/${DATABASE}/documents`;

const execFileAsync = promisify(execFile);
const firebaseCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
const firebaseArgs = process.platform === "win32"
  ? ["/d", "/s", "/c", "npx firebase-tools@15.23.0 login:list --json"]
  : ["firebase-tools@15.23.0", "login:list", "--json"];
const { stdout: sessionOutput } = await execFileAsync(firebaseCommand, firebaseArgs, { windowsHide: true, maxBuffer: 2_000_000 });
const session = (JSON.parse(sessionOutput)?.result || []).find((entry) => entry?.tokens?.access_token && entry?.user?.email);
if (!session?.tokens?.access_token || Number(session.tokens.expires_at || 0) < Date.now() + 20_000) {
  throw new Error("Session Firebase CLI expirée; renouveler la session avant cette correction bornée.");
}
const headers = { Authorization: `Bearer ${session.tokens.access_token}`, "Content-Type": "application/json" };

function safeId(value) {
  if (!/^[a-z0-9-]{3,180}$/i.test(value)) throw new Error(`Identifiant Firestore invalide : ${value}`);
  return value;
}

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object" && value.$timestamp) return { timestampValue: value.$timestamp };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)])) } };
  throw new Error(`Type Firestore non pris en charge : ${typeof value}.`);
}

function decode(value = {}) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decode(child)]));
  return undefined;
}

function decodeDocument(document) {
  return Object.fromEntries(Object.entries(document?.fields || {}).map(([key, value]) => [key, decode(value)]));
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const raw = await response.text();
  return { ok: response.ok, status: response.status, body: raw ? JSON.parse(raw) : null };
}

async function getDocument(collection, id) {
  const response = await request(`${base}/documents/${collection}/${safeId(id)}`);
  if (response.status === 404) return { exists: false, data: null, updateTime: null };
  if (!response.ok) throw new Error(`Lecture refusée pour ${collection}/${id} (${response.status}).`);
  return { exists: true, data: decodeDocument(response.body), updateTime: response.body.updateTime };
}

function documentName(collection, id) {
  return `${root}/${collection}/${safeId(id)}`;
}

function updateWrite(collection, id, data, current) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));
  return {
    update: { name: documentName(collection, id), fields },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: { updateTime: current.updateTime }
  };
}

function createWrite(collection, id, data) {
  return {
    update: { name: documentName(collection, id), fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)])) },
    currentDocument: { exists: false }
  };
}

function actionItemQueueKey(value, actionItemId) {
  const priority = Number(value.priorityKey);
  if (!Number.isInteger(priority) || priority < 0 || priority > 9999) throw new Error("Priorité de décision invalide.");
  const stateToken = value.state === "pending" ? "p" : value.state === "done" ? "d" : "";
  if (!stateToken) throw new Error("État de décision invalide.");
  return `aq1|${value.assigneeUid.length}|${value.assigneeUid}|${value.assigneeRole}|${stateToken}|${String(priority).padStart(4, "0")}|${value.eventDateIso}|${actionItemId}`;
}

const [project, event, actionItem, archive, usersResponse] = await Promise.all([
  getDocument("internalProjectStates", INTERNAL_PROJECT_ID),
  getDocument("projectCalendarEvents", EVENT_ID),
  getDocument("actionItems", ACTION_ID),
  getDocument("changeArchive", MUTATION_ID),
  request(`${base}/documents/users?pageSize=100`)
]);
if (!project.exists) throw new Error("L’état Firestore du projet Au bord du bleu est introuvable.");
if (!event.exists || event.data.projectId !== INTERNAL_PROJECT_ID) throw new Error("L’événement historique Au bord du bleu est introuvable ou mal rattaché.");
if (!actionItem.exists || actionItem.data.sourceId !== INTERNAL_PROJECT_ID) throw new Error("La notification du guide terrain est introuvable ou mal rattachée.");
if (!usersResponse.ok) throw new Error(`Lecture des comptes refusée (${usersResponse.status}).`);

const admins = (usersResponse.body.documents || [])
  .map((document) => ({ uid: document.name.split("/").pop(), ...decodeDocument(document) }))
  .filter((user) => user.role === "admin" && user.active === true);
if (admins.length !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.length}).`);
const actor = admins[0];
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);

if (!archive.exists) {
  if (!["active", "completed"].includes(project.data.stage)) throw new Error(`Le projet a changé d’étape (${project.data.stage || "absente"}); relire avant de clore.`);
  if (!["confirmed", "completed"].includes(event.data.stage)) throw new Error(`L’événement a changé d’étape (${event.data.stage || "absente"}); relire avant de clore.`);
  if (!["pending", "done"].includes(actionItem.data.state)) throw new Error(`La notification a un état inattendu (${actionItem.data.state || "absent"}).`);
}
const actionAfter = { ...actionItem.data, state: "done" };
actionAfter.queueKey = actionItemQueueKey(actionAfter, ACTION_ID);
const finalState = project.data.stage === "completed" && event.data.stage === "completed" && actionItem.data.state === "done";
if (archive.exists && !finalState) throw new Error("L’archive existe, mais l’état opérationnel n’est plus final; aucune écriture automatique n’est permise.");

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  actor: actorLabel,
  project: { id: INTERNAL_PROJECT_ID, before: project.data.stage, after: "completed" },
  event: { id: EVENT_ID, before: event.data.stage, after: "completed" },
  actionItem: { id: ACTION_ID, before: actionItem.data.state, after: "done" },
  archiveExists: archive.exists,
  alreadyFinal: finalState,
  plannedWrites: archive.exists ? 0 : (finalState ? 1 : 4)
}, null, 2));

if (APPLY && !archive.exists) {
  const now = new Date().toISOString();
  const archiveData = {
    entityType: "internalProjectState",
    entityId: INTERNAL_PROJECT_ID,
    action: "projet Au bord du bleu clôturé et archivé après tenue réussie de l’événement",
    before: {
      project: { projectId: INTERNAL_PROJECT_ID, stage: project.data.stage },
      event: { eventId: EVENT_ID, stage: event.data.stage },
      actionItem: { id: ACTION_ID, state: actionItem.data.state, queueKey: actionItem.data.queueKey || "" }
    },
    after: {
      project: { projectId: INTERNAL_PROJECT_ID, stage: "completed" },
      event: { eventId: EVENT_ID, stage: "completed" },
      actionItem: { id: ACTION_ID, state: "done", queueKey: actionAfter.queueKey }
    },
    actorUid: actor.uid,
    actorLabel,
    createdAt: { $timestamp: now }
  };
  const writes = [createWrite("changeArchive", MUTATION_ID, archiveData)];
  if (!finalState) {
    writes.push(
      updateWrite("internalProjectStates", INTERNAL_PROJECT_ID, {
        stage: "completed", updatedAt: { $timestamp: now }, updatedBy: actor.uid, updatedByLabel: actorLabel
      }, project),
      updateWrite("projectCalendarEvents", EVENT_ID, {
        stage: "completed", updatedAt: { $timestamp: now }, updatedBy: actor.uid, updatedByLabel: actorLabel
      }, event),
      updateWrite("actionItems", ACTION_ID, {
        state: "done", queueKey: actionAfter.queueKey, lastMutationId: MUTATION_ID, updatedAt: { $timestamp: now }, updatedBy: actor.uid
      }, actionItem)
    );
  }
  const commit = await request(`${base}/documents:commit`, { method: "POST", body: JSON.stringify({ writes }) });
  if (!commit.ok) throw new Error(`Clôture Firestore refusée (${commit.status}) : ${JSON.stringify(commit.body).slice(0, 600)}`);
}

if (APPLY) {
  const [verifiedProject, verifiedEvent, verifiedAction, verifiedArchive] = await Promise.all([
    getDocument("internalProjectStates", INTERNAL_PROJECT_ID),
    getDocument("projectCalendarEvents", EVENT_ID),
    getDocument("actionItems", ACTION_ID),
    getDocument("changeArchive", MUTATION_ID)
  ]);
  if (verifiedProject.data?.stage !== "completed" || verifiedEvent.data?.stage !== "completed" || verifiedAction.data?.state !== "done" || !verifiedArchive.exists) {
    throw new Error("La vérification après écriture n’a pas retrouvé l’état de clôture complet.");
  }
  console.log("Clôture Firestore vérifiée : projet archivé, événement terminé et notification classée.");
}
