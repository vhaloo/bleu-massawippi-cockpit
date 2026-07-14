import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { GeoPoint, Timestamp, getFirestore } from "firebase-admin/firestore";
import { createBackup } from "./backup_firestore.mjs";
import { restoreDocuments, verifyBackup } from "./restore_firestore_backup.mjs";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Ce test doit être exécuté avec l’Emulator Firestore.");
const suffix = `${Date.now()}-${process.pid}`;
const sourceApp = initializeApp({ projectId: `cockpit-backup-source-${suffix}` }, `source-${suffix}`);
const targetApp = initializeApp({ projectId: `cockpit-backup-target-${suffix}` }, `target-${suffix}`);
const source = getFirestore(sourceApp);
const target = getFirestore(targetApp);
const createdAt = new Timestamp(1784030400, 123456789);
await source.doc("events/e1").set({ title: "Libellule", createdAt, location: new GeoPoint(45.17, -72.05), bytes: Buffer.from("bleu") });
await source.doc("events/e1/comments/c1").set({ body: "Commentaire de test", event: source.doc("events/e1") });
await source.doc("tasks/t1").set({ status: "pending", owner: "direction" });
const persistedSourceEvent = (await source.doc("events/e1").get()).data();

const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cockpit-emulator-backup-"));
try {
  const backup = await createBackup({ db: source, projectId: sourceApp.options.projectId, outputRoot });
  assert.equal(backup.documentCount, 3);
  assert.equal(backup.collectionCount, 3);
  const verified = await verifyBackup(backup.directory);
  const first = await restoreDocuments({ db: target, documents: verified.documents, apply: true });
  assert.equal(first.writes, 3);
  const second = await restoreDocuments({ db: target, documents: verified.documents, apply: true });
  assert.equal(second.writes, 3);
  const event = await target.doc("events/e1").get();
  const comment = await target.doc("events/e1/comments/c1").get();
  assert.equal(event.data().title, "Libellule");
  assert.equal(event.data().createdAt.nanoseconds, persistedSourceEvent.createdAt.nanoseconds);
  assert.equal(event.data().location.latitude, 45.17);
  assert.equal(event.data().bytes.toString(), "bleu");
  assert.equal(comment.data().body, "Commentaire de test");
  assert.equal(comment.data().event.path, "events/e1");
  console.log("Emulator backup/restore: 10 assertions réussies, 3 documents, sous-collection et types préservés.");
} finally {
  await Promise.all([deleteApp(sourceApp), deleteApp(targetApp)]);
  await fs.rm(outputRoot, { recursive: true, force: true });
}
