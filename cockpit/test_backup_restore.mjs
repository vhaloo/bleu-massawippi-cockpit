import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createBackup } from "./backup_firestore.mjs";
import { decodeBackupValue, encodeBackupValue } from "./firestore_backup_codec.mjs";
import { restoreDocuments, verifyBackup } from "./restore_firestore_backup.mjs";

const complex = {
  text: "Massawippi",
  active: true,
  count: 3,
  nested: { __cockpitBackupType: "contenu utilisateur", values: [1, null, Number.NaN] },
  bytes: Buffer.from("bleu"),
  date: new Date("2026-07-14T12:00:00Z")
};
const decoded = decodeBackupValue(encodeBackupValue(complex));
assert.equal(decoded.text, complex.text);
assert.equal(decoded.nested.__cockpitBackupType, "contenu utilisateur");
assert.ok(Number.isNaN(decoded.nested.values[2]));
assert.equal(decoded.bytes.toString(), "bleu");
assert.equal(decoded.date.toISOString(), complex.date.toISOString());

function fakeRef(pathValue, data, children = []) {
  return {
    path: pathValue,
    data: () => data,
    listCollections: async () => children,
    ref: null
  };
}
function fakeCollection(pathValue, docs) {
  return { path: pathValue, get: async () => ({ size: docs.length, docs }) };
}
const childDoc = fakeRef("events/e1/comments/c1", { body: "Bonjour" });
childDoc.ref = childDoc;
const child = fakeCollection("events/e1/comments", [childDoc]);
const eventDoc = fakeRef("events/e1", complex, [child]);
eventDoc.ref = eventDoc;
const top = fakeCollection("events", [eventDoc]);
const sourceDb = { listCollections: async () => [top] };
const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cockpit-backup-test-"));
const backup = await createBackup({ db: sourceDb, projectId: "cockpit-test", outputRoot, now: new Date("2026-07-14T12:00:00Z") });
assert.equal(backup.documentCount, 2);
assert.equal(backup.collectionCount, 2);
const verified = await verifyBackup(backup.directory);
assert.deepEqual(verified.documents.map((item) => item.path), ["events/e1", "events/e1/comments/c1"]);

const writes = [];
const targetDb = {
  doc: (documentPath) => ({ path: documentPath }),
  batch: () => {
    const pending = [];
    return {
      set: (ref, data, options) => pending.push({ ref, data, options }),
      commit: async () => writes.push(...pending)
    };
  }
};
const dryRun = await restoreDocuments({ db: targetDb, documents: verified.documents });
assert.equal(dryRun.writes, 0);
await restoreDocuments({ db: targetDb, documents: verified.documents, apply: true, batchSize: 1 });
assert.equal(writes.length, 2);
assert.equal(writes[0].options.merge, false);
assert.equal(writes[0].data.text, "Massawippi");
await restoreDocuments({ db: targetDb, documents: verified.documents, apply: true, batchSize: 2 });
assert.equal(writes.length, 4, "Une seconde restauration doit être idempotente et réécrire les mêmes chemins.");

const manifestPath = path.join(backup.directory, "documents.ndjson");
await fs.appendFile(manifestPath, "corruption\n");
await assert.rejects(() => verifyBackup(backup.directory), /altéré/);
await fs.rm(outputRoot, { recursive: true, force: true });
console.log("Backup/restore: 15 assertions réussies.");
