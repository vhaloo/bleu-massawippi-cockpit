import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { normalizeProjectCalendarEvent } from "./project-calendar-model.mjs";
import { isDryRun, sameSeedFields } from "./seed_utils.js";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-project-calendar-20260803");
const manifest = JSON.parse(fs.readFileSync(new URL("./project_calendar_events.json", import.meta.url), "utf8"));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.events)) throw new Error("Manifeste du calendrier de projets invalide.");

const desiredEvents = manifest.events.map((item) => {
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(item.id || ""))) throw new Error(`Identifiant invalide : ${item.id || "vide"}.`);
  return { id: item.id, ...normalizeProjectCalendarEvent(item) };
});
if (new Set(desiredEvents.map((item) => item.id)).size !== desiredEvents.length) throw new Error("Le manifeste contient des identifiants en double.");

if (isDryRun() && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log(JSON.stringify({ ready: true, dryRun: true, seed: "project-calendar", events: desiredEvents.length, maximumReads: desiredEvents.length + 1, maximumWrites: desiredEvents.length * 2 }, null, 2));
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-project-calendar-20260803 après vérification du dry-run.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860" });
const db = getFirestore(app);

try {
  const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
  if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
  const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
  const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);
  const operations = [];
  for (const desired of desiredEvents) {
    const reference = db.collection("projectCalendarEvents").doc(desired.id);
    const snapshot = await reference.get();
    const before = snapshot.exists ? snapshot.data() : {};
    const seedFields = Object.fromEntries(Object.entries(desired).filter(([key]) => key !== "id"));
    operations.push({ desired, reference, snapshot, before, seedFields, operation: snapshot.exists ? (sameSeedFields(before, seedFields) ? "unchanged" : "update") : "create" });
  }
  const changes = operations.filter((item) => item.operation !== "unchanged");
  if (!APPLY) {
    console.log(JSON.stringify({ mode: "dry-run", actor: actorLabel, events: operations.length, creates: operations.filter((item) => item.operation === "create").length, updates: operations.filter((item) => item.operation === "update").length, unchanged: operations.filter((item) => item.operation === "unchanged").length, estimatedReads: operations.length + 1, maximumWrites: changes.length * 2 }, null, 2));
    process.exit(0);
  }
  if (changes.length) {
    await db.runTransaction(async (transaction) => {
      const current = [];
      for (const operation of changes) current.push(await transaction.get(operation.reference));
      changes.forEach((operation, index) => {
        const latest = current[index];
        if (latest.exists !== operation.snapshot.exists || (latest.exists && !latest.updateTime?.isEqual?.(operation.snapshot.updateTime))) throw new Error(`L’événement ${operation.desired.id} a changé depuis le dry-run.`);
      });
      const now = FieldValue.serverTimestamp();
      changes.forEach((operation) => {
        const payload = {
          ...operation.seedFields,
          eventId: operation.desired.id,
          createdAt: operation.snapshot.exists ? operation.before.createdAt : now,
          updatedAt: now,
          updatedBy: actor.uid,
          updatedByLabel: actorLabel
        };
        transaction.set(operation.reference, payload);
        const fingerprint = crypto.createHash("sha256").update(JSON.stringify(operation.seedFields)).digest("hex").slice(0, 12);
        const archiveId = `project-calendar-${operation.desired.id}-${fingerprint}`.slice(0, 160);
        transaction.set(db.collection("changeArchive").doc(archiveId), {
          entityType: "projectCalendarEvent",
          entityId: operation.desired.id,
          action: operation.operation === "create" ? "événement de projet créé" : "événement de projet mis à jour",
          before: { title: operation.before.title || "", startDate: operation.before.startDate || "", endDate: operation.before.endDate || "", stage: operation.before.stage || "" },
          after: { title: payload.title, startDate: payload.startDate, endDate: payload.endDate, stage: payload.stage },
          actorUid: actor.uid,
          actorLabel,
          createdAt: now
        });
      });
    });
  }
  console.log(JSON.stringify({ seeded: true, events: operations.length, creates: operations.filter((item) => item.operation === "create").length, updates: operations.filter((item) => item.operation === "update").length, unchanged: operations.filter((item) => item.operation === "unchanged").length, reads: operations.length + 1, writes: changes.length * 2 }, null, 2));
} finally {
  await deleteApp(app);
}
