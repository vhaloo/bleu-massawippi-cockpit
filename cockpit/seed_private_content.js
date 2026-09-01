import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { applyPlanOverridesToPosts, preparePlanScript } from "./plan-overrides.js";
import { assertProtectedScheduleChange, protectedScheduleFields } from "./seed_utils.js";

const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(workspaceDir, "..", "index.html");
const dryRun = process.argv.includes("--dry-run");
const contentOnly = process.argv.includes("--content-only");
const firebaseCliRest = process.argv.includes("--firebase-cli-rest");
const idsArg = process.argv.find((arg) => arg.startsWith("--ids="));
const completedRescheduleArg = process.argv.find((arg) => arg.startsWith("--allow-completed-reschedule="));
const completedRescheduleReasonArg = process.argv.find((arg) => arg.startsWith("--reschedule-reason="));
const selectedIds = idsArg
  ? [...new Set(idsArg.slice("--ids=".length).split(",").map((id) => id.trim()).filter(Boolean))]
  : null;
const allowedCompletedRescheduleIds = new Set(completedRescheduleArg
  ? completedRescheduleArg.slice("--allow-completed-reschedule=".length).split(",").map((id) => id.trim()).filter(Boolean)
  : []);
const completedRescheduleReason = completedRescheduleReasonArg
  ? completedRescheduleReasonArg.slice("--reschedule-reason=".length).trim()
  : "";
if (selectedIds?.some((id) => !/^[a-z0-9-]{3,80}$/i.test(id))) {
  throw new Error("--ids contient un identifiant de publication invalide.");
}
if ([...allowedCompletedRescheduleIds].some((id) => !/^[a-z0-9-]{3,80}$/i.test(id))) {
  throw new Error("--allow-completed-reschedule contient un identifiant de publication invalide.");
}
const source = await fs.readFile(sourcePath, "utf8");
const css = source.match(/<style>([\s\S]*?)<\/style>/i)?.[1];
const html = source.match(/<body>([\s\S]*?)<script>\s*var posts=/i)?.[1]?.trim();
const script = source.match(/<script>\s*(var posts=\[[\s\S]*?)<\/script>/i)?.[1];
const postsJson = script?.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];

if (!css || !html || !script || !postsJson) {
  throw new Error("La structure du plan source ne permet pas de préparer le contenu sécurisé.");
}

const posts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const mainPosts = Array.isArray(posts) ? posts.filter((post) => post.isAlternative !== true) : [];
if (!Array.isArray(posts) || mainPosts.length < 28 || posts.length < mainPosts.length) {
  throw new Error("Le plan source doit contenir au moins 28 publications principales et ses alternatives éventuelles.");
}
const selectedPosts = selectedIds ? posts.filter((post) => selectedIds.includes(post.id)) : posts;
if (selectedIds && selectedPosts.length !== selectedIds.length) {
  const found = new Set(selectedPosts.map((post) => post.id));
  throw new Error("Publication introuvable dans --ids : " + selectedIds.filter((id) => !found.has(id)).join(", "));
}

const privateContent = {
  schemaVersion: 1,
  css,
  html,
  script: preparePlanScript(script, posts)
};
const size = Buffer.byteLength(JSON.stringify(privateContent), "utf8");
if (size > 900000) throw new Error("Le contenu privé dépasse la limite de sécurité de 900 Ko.");
const contentHash = crypto.createHash("sha256").update(JSON.stringify(privateContent)).digest("hex");

if (dryRun) {
  console.log(JSON.stringify({ sourcePath, posts: posts.length, selectedPosts: contentOnly ? 0 : selectedPosts.length, selectedIds, allowedCompletedRescheduleIds: [...allowedCompletedRescheduleIds], hasCompletedRescheduleReason: completedRescheduleReason.length >= 20, privateContentBytes: size, contentHash, contentOnly, firebaseCliRest, ready: true }, null, 2));
  process.exit(0);
}

function encodeFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFirestoreFields(value) } };
  throw new Error(`Type Firestore non pris en charge : ${typeof value}`);
}

function encodeFirestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encodeFirestoreValue(child)]));
}

function decodeFirestoreValue(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  return undefined;
}

async function synchronizePrivateContentWithFirebaseCli() {
  if (!contentOnly) {
    throw new Error("--firebase-cli-rest exige --content-only afin de ne jamais toucher aux publications ni à leur workflow.");
  }
  const execFileAsync = promisify(execFile);
  const firebaseCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx";
  const firebaseArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "npx firebase-tools@15.23.0 login:list --json"]
    : ["firebase-tools@15.23.0", "login:list", "--json"];
  const { stdout } = await execFileAsync(firebaseCommand, firebaseArgs, { windowsHide: true, maxBuffer: 2_000_000 });
  const session = (JSON.parse(stdout)?.result || []).find((entry) => entry?.tokens?.access_token && entry?.user?.email);
  const accessToken = session?.tokens?.access_token;
  if (!accessToken || Number(session.tokens?.expires_at || 0) < Date.now() + 120_000) {
    throw new Error("Session Firebase CLI expirée; renouveler la session avant cette synchronisation bornée.");
  }
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860";
  const database = "(default)";
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${database}`;
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const currentResponse = await fetch(`${base}/documents/privateContent/plan`, { headers });
  if (!currentResponse.ok && currentResponse.status !== 404) {
    throw new Error(`Lecture du contenu privé refusée (${currentResponse.status}).`);
  }
  const currentDocument = currentResponse.ok ? await currentResponse.json() : null;
  const currentHash = decodeFirestoreValue(currentDocument?.fields?.contentHash);
  if (currentHash === contentHash) {
    console.log(JSON.stringify({ seeded: true, contentOnly: true, contentChanged: false, writes: 0, privateContentBytes: size, contentHash, authMode: "firebase-cli-rest" }, null, 2));
    return;
  }

  const now = new Date().toISOString();
  const versionId = `content-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
  const versionName = `projects/${projectId}/databases/${database}/documents/privateContentVersions/${versionId}`;
  const planName = `projects/${projectId}/databases/${database}/documents/privateContent/plan`;
  const versionFields = encodeFirestoreFields({ ...privateContent, contentHash, source: "index.html" });
  versionFields.createdAt = { timestampValue: now };
  const planFields = encodeFirestoreFields({ ...privateContent, contentHash });
  planFields.updatedAt = { timestampValue: now };
  const commitResponse = await fetch(`${base}/documents:commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ writes: [
      { update: { name: versionName, fields: versionFields }, currentDocument: { exists: false } },
      { update: { name: planName, fields: planFields }, ...(currentDocument ? { currentDocument: { updateTime: currentDocument.updateTime } } : { currentDocument: { exists: false } }) }
    ] })
  });
  if (!commitResponse.ok) {
    const detail = (await commitResponse.text()).slice(0, 500);
    throw new Error(`Synchronisation du contenu privé refusée (${commitResponse.status}) : ${detail}`);
  }
  console.log(JSON.stringify({ seeded: true, contentOnly: true, contentChanged: true, writes: 2, privateContentBytes: size, contentHash, previousContentHash: currentHash || null, versionId, authMode: "firebase-cli-rest" }, null, 2));
}

if (firebaseCliRest) {
  await synchronizePrivateContentWithFirebaseCli();
  process.exit(0);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
}

const app = initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined
});
const db = getFirestore(app);
const batch = db.batch();
const planRef = db.collection("privateContent").doc("plan");
const existingPlan = await planRef.get();
const contentChanged = !existingPlan.exists || existingPlan.data()?.contentHash !== contentHash;
const versionRef = contentChanged ? db.collection("privateContentVersions").doc() : null;
let writeOperations = 0;
if (contentChanged) {
  batch.set(versionRef, { ...privateContent, contentHash, source: "index.html", createdAt: FieldValue.serverTimestamp() });
  batch.set(planRef, { ...privateContent, contentHash, updatedAt: FieldValue.serverTimestamp() });
  writeOperations += 2;
}

let createdStates = 0;
let updatedStates = 0;
let unchangedStates = 0;
let protectedWorkflowReads = 0;
let overriddenCompletedMoves = 0;
for (const post of contentOnly ? [] : selectedPosts) {
  if (!/^[a-z0-9-]{3,80}$/i.test(post.id)) throw new Error("Identifiant de publication invalide : " + post.id);
  const ref = db.collection("scheduleItems").doc(post.id);
  const existing = await ref.get();
  const contentFields = {
    title: String(post.title).slice(0, 220),
    dateKey: String(post.date).slice(0, 80),
    dateIso: String(post.dateIso || "").slice(0, 10),
    format: String(post.format || "").slice(0, 220),
    role: String(post.role || "").slice(0, 5000),
    cta: String(post.cta || "").slice(0, 220),
    source: String(post.source || "").slice(0, 500),
    tasksValentin: Array.isArray(post.tasksValentin) ? post.tasksValentin.map((task) => String(task).slice(0, 1000)).slice(0, 8) : [String(post.task || "").slice(0, 1000)],
    tasksAnnie: Array.isArray(post.tasksAnnie) ? post.tasksAnnie.map((task) => String(task).slice(0, 1000)).slice(0, 8) : [],
    calendarTime: /^\d{2}:\d{2}$/.test(String(post.calendarTime || ""))
      ? String(post.calendarTime)
      : (({ "Lundi": "09:00", "Mardi": "12:00", "Mercredi": "18:00", "Jeudi": "12:00", "Vendredi": "17:00", "Samedi": "10:00", "Dimanche": "09:00" })[String(post.date || "").split(" ")[0]] || "12:00"),
    calendarDurationMinutes: 30,
    calendarLocation: post.id === "s1d1" ? "Église Saint-Barthélemy, 911, rue Clough, Ayer’s Cliff, Québec J0B 1C0" : "En ligne — Facebook / Instagram",
    calendarCost: "Aucun coût de diffusion; confirmer les droits, la production et tout achat éventuel."
  };
  if (existing.exists) {
    const before = existing.data() || {};
    const changedFields = Object.keys(contentFields).filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(contentFields[key] ?? null));
    if (changedFields.length) {
      let scheduleProtection = null;
      if (changedFields.some((key) => protectedScheduleFields.includes(key))) {
        const workflowSnapshot = await db.collection("workflowStates").doc(post.id).get();
        protectedWorkflowReads += 1;
        scheduleProtection = assertProtectedScheduleChange({
          eventId: post.id,
          before,
          after: contentFields,
          workflowStage: workflowSnapshot.exists ? workflowSnapshot.data()?.stage : "proposal",
          allowedEventIds: allowedCompletedRescheduleIds,
          reason: completedRescheduleReason
        });
        if (scheduleProtection.overrideUsed) overriddenCompletedMoves += 1;
      }
      const archiveRef = db.collection("changeArchive").doc();
      batch.set(archiveRef, {
        entityType: "scheduleItem",
        entityId: post.id,
        action: `synchronisation du contenu : ${changedFields.join(", ")}`.slice(0, 160),
        before: Object.fromEntries(Object.keys(contentFields).map((key) => [key, before[key] ?? null])),
        after: contentFields,
        protectedWorkflowStage: scheduleProtection?.workflowStage || null,
        completedScheduleOverride: scheduleProtection?.overrideUsed === true,
        completedScheduleOverrideReason: scheduleProtection?.overrideUsed ? scheduleProtection.reason : null,
        actorUid: "system_seed",
        actorLabel: "Synchronisation du calendrier",
        createdAt: FieldValue.serverTimestamp()
      });
      batch.set(ref, {
        ...contentFields,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "system_seed"
      }, { merge: true });
      updatedStates += 1;
      writeOperations += 2;
    } else {
      unchangedStates += 1;
    }
  } else {
    batch.set(ref, {
      ...contentFields,
      status: "pending",
      deleted: false,
      selected: post.choiceRequired !== true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "system_seed"
    }, { merge: true });
    createdStates += 1;
    writeOperations += 1;
  }
}

if (writeOperations > 0) await batch.commit();
console.log(JSON.stringify({ seeded: true, contentOnly, contentChanged, posts: posts.length, selectedPosts: contentOnly ? 0 : selectedPosts.length, selectedIds, mainPosts: mainPosts.length, createdStates, updatedStates, unchangedStates, protectedWorkflowReads, overriddenCompletedMoves, writes: writeOperations, privateContentBytes: size, contentHash, versionId: versionRef?.id || null }, null, 2));
