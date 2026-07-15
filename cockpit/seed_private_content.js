import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { applyPlanOverridesToPosts, preparePlanScript } from "./plan-overrides.js";

const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(workspaceDir, "..", "index.html");
const dryRun = process.argv.includes("--dry-run");
const contentOnly = process.argv.includes("--content-only");
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
if (!Array.isArray(posts) || mainPosts.length !== 28 || posts.length < 28) {
  throw new Error("Le plan source doit contenir 28 publications principales et ses alternatives éventuelles.");
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
  console.log(JSON.stringify({ sourcePath, posts: posts.length, privateContentBytes: size, contentOnly, ready: true }, null, 2));
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
for (const post of contentOnly ? [] : posts) {
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
      const archiveRef = db.collection("changeArchive").doc();
      batch.set(archiveRef, {
        entityType: "scheduleItem",
        entityId: post.id,
        action: `synchronisation du contenu : ${changedFields.join(", ")}`.slice(0, 160),
        before: Object.fromEntries(Object.keys(contentFields).map((key) => [key, before[key] ?? null])),
        after: contentFields,
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
console.log(JSON.stringify({ seeded: true, contentOnly, contentChanged, posts: posts.length, mainPosts: mainPosts.length, createdStates, updatedStates, unchangedStates, writes: writeOperations, privateContentBytes: size, contentHash, versionId: versionRef?.id || null }, null, 2));
