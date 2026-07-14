#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { encodeBackupValue } from "./firestore_backup_codec.mjs";
import { verifyBackup } from "./restore_firestore_backup.mjs";

function backupArgument(argv) {
  const token = argv.find((item) => item.startsWith("--backup="));
  if (!token) throw new Error("Utiliser --backup=CHEMIN.");
  return path.resolve(token.slice("--backup=".length));
}

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("La comparaison exhaustive est réservée à l’Emulator Firestore.");
const backup = await verifyBackup(backupArgument(process.argv.slice(2)));
const app = initializeApp({ projectId: backup.summary.projectId }, `verify-${Date.now()}-${process.pid}`);
const db = getFirestore(app);
let verified = 0;
try {
  for (let offset = 0; offset < backup.documents.length; offset += 200) {
    const expected = backup.documents.slice(offset, offset + 200);
    const snapshots = await db.getAll(...expected.map((document) => db.doc(document.path)));
    snapshots.forEach((snapshot, index) => {
      assert.equal(snapshot.exists, true, `Document restauré absent : ${expected[index].path}`);
      assert.deepEqual(encodeBackupValue(snapshot.data()), expected[index].data, `Document restauré différent : ${expected[index].path}`);
      verified += 1;
    });
  }
  assert.equal(verified, backup.summary.documentCount);
  console.log(JSON.stringify({ status: "verified", projectId: backup.summary.projectId, documentsCompared: verified, collections: backup.summary.collectionCount }, null, 2));
} finally {
  await deleteApp(app);
}
