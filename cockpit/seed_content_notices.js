import fs from "node:fs";
import process from "node:process";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { isDryRun } from "./seed_utils.js";

const manifest = JSON.parse(fs.readFileSync(new URL("./content_notices.json", import.meta.url), "utf8"));
const noticeFilter = process.argv.find((value) => value.startsWith("--notice="))?.slice(9).trim() || "";
const allowedRoles = new Set(["director", "admin"]);
const allowedTypes = new Set(["section", "opportunity", "internalProject"]);

function queueKey(item, actionId) {
  return `aq1|${item.assigneeUid.length}|${item.assigneeUid}|${item.assigneeRole}|p|${String(item.priorityKey).padStart(4, "0")}|${item.eventDateIso}|${actionId}`;
}

function validateNotice(item) {
  if (!/^[a-z0-9-]{3,120}$/.test(String(item.id || ""))) throw new Error(`Identifiant de nouveauté invalide : ${item.id || "vide"}.`);
  if (!allowedRoles.has(item.audienceRole)) throw new Error(`Rôle invalide pour ${item.id}.`);
  if (!/^\S+@\S+\.\S+$/.test(String(item.assigneeEmail || ""))) throw new Error(`Courriel invalide pour ${item.id}.`);
  if (!allowedTypes.has(item.sourceType)) throw new Error(`Type de cible invalide pour ${item.id}.`);
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(item.sourceId || ""))) throw new Error(`Cible invalide pour ${item.id}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.publishedOn || ""))) throw new Error(`Date invalide pour ${item.id}.`);
  if (!Number.isInteger(item.priorityKey) || item.priorityKey < 0 || item.priorityKey > 9999) throw new Error(`Priorité invalide pour ${item.id}.`);
  if (!String(item.title || "").trim() || String(item.title).length > 220) throw new Error(`Titre invalide pour ${item.id}.`);
  if (String(item.message || "").length > 1500) throw new Error(`Message trop long pour ${item.id}.`);
}

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.notices)) throw new Error("Manifeste de nouveautés invalide.");
manifest.notices.forEach(validateNotice);
const selected = manifest.notices.filter((item) => !noticeFilter || item.id === noticeFilter);
if (!selected.length) throw new Error(`Nouveauté introuvable : ${noticeFilter || "manifeste vide"}.`);

if (isDryRun()) {
  console.log(JSON.stringify({ ready: true, dryRun: true, seed: "content-notices", notices: selected.length, maximumReads: selected.length + 2, maximumWrites: selected.length, noticeFilter: noticeFilter || null }, null, 2));
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service Firebase requis.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860" });
const db = getFirestore(app);
const auth = getAuth(app);
const assigneeEmail = selected[0].assigneeEmail.toLowerCase();
if (selected.some((item) => item.assigneeEmail.toLowerCase() !== assigneeEmail || item.audienceRole !== selected[0].audienceRole)) {
  throw new Error("Une exécution doit viser une seule file personnelle.");
}
const assignee = await auth.getUserByEmail(assigneeEmail);
const assigneeProfile = await db.collection("users").doc(assignee.uid).get();
if (!assigneeProfile.exists || assigneeProfile.data().active !== true || assigneeProfile.data().role !== selected[0].audienceRole) {
  throw new Error("Le compte destinataire n’est pas actif avec le rôle attendu.");
}

let created = 0;
let preserved = 0;
for (const notice of selected) {
  const actionId = `content-notice-${notice.id}`;
  const reference = db.collection("actionItems").doc(actionId);
  const existing = await reference.get();
  // Une version vue ne doit jamais être rouverte. Pour signaler une édition
  // ultérieure, ajouter une nouvelle entrée versionnée au manifeste.
  if (existing.exists) {
    preserved += 1;
    continue;
  }
  const item = {
    assigneeUid: assignee.uid,
    assigneeRole: notice.audienceRole,
    state: "pending",
    sourceType: notice.sourceType,
    sourceId: notice.sourceId,
    mediaId: "",
    eventDateIso: notice.publishedOn,
    actionType: "content_notice",
    title: notice.title,
    message: notice.message,
    priorityKey: notice.priorityKey,
    createdByUid: "system_content_notice",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "system_content_notice",
    lastMutationId: `seed-${notice.id}`,
    schemaVersion: 1
  };
  item.queueKey = queueKey(item, actionId);
  await reference.create(item);
  created += 1;
}

console.log(JSON.stringify({ seeded: true, notices: selected.length, created, preserved, reads: selected.length + 1, writes: created, noticeFilter: noticeFilter || null }, null, 2));
