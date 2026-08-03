import process from "node:process";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const eventId = "alt-20260801";
const mediaIds = [
  "history-alt-20260801-aerial",
  "history-alt-20260801-aerial-current-2024"
];
const dryRun = process.argv.includes("--dry-run");

if (dryRun) {
  console.log(JSON.stringify({
    ready: true,
    dryRun: true,
    eventId,
    mediaIds,
    intendedState: { stage: "proposal", archived: false, publicationBlocked: false },
    maxWrites: mediaIds.length * 2
  }, null, 2));
  process.exit(0);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
}

const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
const db = getFirestore(app);
let updated = 0;
let unchanged = 0;

for (const mediaId of mediaIds) {
  await db.runTransaction(async (transaction) => {
    const reference = db.collection("mediaLinks").doc(mediaId);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error(`Média introuvable : ${mediaId}. Exécutez d’abord le seed historique ciblé.`);
    const before = snapshot.data();
    if (before.eventId !== eventId) throw new Error(`Le média ${mediaId} n’appartient pas à ${eventId}.`);
    const after = { stage: "proposal", archived: false, publicationBlocked: false };
    if (before.stage === after.stage && before.archived === false && before.publicationBlocked === false) {
      unchanged += 1;
      return;
    }
    const now = FieldValue.serverTimestamp();
    transaction.set(reference, { ...after, updatedAt: now, updatedBy: "system-reconcile-aug5-carousel" }, { merge: true });
    transaction.set(db.collection("changeArchive").doc(), {
      entityType: "mediaLink",
      entityId: mediaId,
      action: "carte rendue sélectionnable dans le carrousel du 5 août",
      before: {
        stage: before.stage || "reference",
        archived: before.archived === true,
        publicationBlocked: before.publicationBlocked === true
      },
      after,
      actorUid: "system-reconcile-aug5-carousel",
      actorLabel: "Réconciliation éditoriale du 5 août",
      createdAt: now
    });
    updated += 1;
  });
}

console.log(JSON.stringify({ reconciled: true, eventId, mediaIds, updated, unchanged, writes: updated * 2 }, null, 2));
