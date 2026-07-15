import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(workspaceDir, "../..");
const mediaDir = path.join(rootDir, "media", "portes-ouvertes");
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
const attachments = [
  {
    id: "s1d1-source-photo",
    filename: "sainte-elisabeth-source-4x5.jpg",
    localName: "sainte-elisabeth-source-4x5.jpg",
    label: "Photo source recadrée 4:5"
  },
  {
    id: "s1d1-proposed-visual",
    filename: "sainte-elisabeth-portes-ouvertes-4x5.jpg",
    localName: "sainte-elisabeth-portes-ouvertes-4x5.jpg",
    label: "Visuel proposé · correction légère sans invention"
  }
];

const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--allow-legacy-storage");
if (dryRun) {
  console.log(JSON.stringify({ ready: true, dryRun: true, seed: "legacy-open-house-attachments", disabledByDefault: true, reason: "Les médias actifs sont hébergés sur SharePoint; Firebase Storage est conservé seulement pour restaurer un ancien flux explicite.", maximumWrites: 0, attachments: attachments.length }, null, 2));
  process.exit(0);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
const app = initializeApp({ credential: applicationDefault(), projectId, storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined });
const db = getFirestore(app);
const bucket = getStorage(app).bucket(bucketName);

for (const item of attachments) {
  const localPath = path.join(mediaDir, item.localName);
  const reference = db.collection("attachments").doc(item.id);
  const existing = await reference.get();
  if (existing.exists) {
    console.log(JSON.stringify({ id: item.id, status: "already-present" }));
    continue;
  }
  const storagePath = `uploads/s1d1/${item.id}-${item.filename}`;
  await bucket.upload(localPath, {
    destination: storagePath,
    resumable: false,
    metadata: {
      contentType: "image/jpeg",
      metadata: { eventId: "s1d1", conversionPreset: "meta-feed-4x5", seededLabel: item.label }
    }
  });
  const stat = await import("node:fs/promises").then(({ stat }) => stat(localPath));
  await reference.set({
    eventId: "s1d1",
    storagePath,
    filename: item.filename,
    contentType: "image/jpeg",
    sizeBytes: stat.size,
    width: 1080,
    height: 1350,
    originalName: item.filename,
    originalWidth: 1080,
    originalHeight: 1350,
    conversionPreset: "meta-feed-4x5",
    downloadedLocally: false,
    archived: false,
    createdByUid: "system-seed",
    createdByLabel: "Préparation locale",
    createdAt: FieldValue.serverTimestamp()
  });
  console.log(JSON.stringify({ id: item.id, status: "seeded", bytes: stat.size, storagePath }));
}
