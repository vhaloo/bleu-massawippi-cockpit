import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { dryRunSummary, isDryRun, sameSeedFields } from "./seed_utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fullManifest = JSON.parse(fs.readFileSync(path.join(here, "nature_media_manifest.json"), "utf8"));
const requestedIds = new Set(String(process.env.MEDIA_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
const manifest = requestedIds.size ? fullManifest.filter((item) => requestedIds.has(item.id)) : fullManifest;
if (requestedIds.size && manifest.length !== requestedIds.size) {
  throw new Error("Un ou plusieurs MEDIA_IDS ne figurent pas dans le manifeste nature.");
}
const privateLinksPath = path.join(here, "secrets", "nature-media-links.json");
if (!fs.existsSync(privateLinksPath)) {
  throw new Error("Le registre local secrets/nature-media-links.json est requis et ne doit jamais être publié.");
}
const privateLinks = JSON.parse(fs.readFileSync(privateLinksPath, "utf8"));
for (const item of manifest) if (!/^https:\/\/bleumassawippi\.sharepoint\.com\/:i:\/g\//.test(privateLinks[item.fileName] || "")) throw new Error(`Lien SharePoint privé manquant pour ${item.fileName}.`);
if (isDryRun()) {
  console.log(JSON.stringify(dryRunSummary("nature-media", manifest, { events: new Set(manifest.map((item) => item.eventId)).size }), null, 2));
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
const db = getFirestore(app);
const batch = db.batch();
let created = 0;
let updated = 0;
let unchanged = 0;

for (const item of manifest) {
  const mediaUrl = privateLinks[item.fileName];
  if (!/^https:\/\/bleumassawippi\.sharepoint\.com\/:i:\/g\//.test(mediaUrl || "")) {
    throw new Error(`Lien SharePoint privé manquant pour ${item.fileName}.`);
  }
  const reference = db.collection("mediaLinks").doc(item.id);
  const existing = await reference.get();
  const contentFields = {
    eventId: item.eventId,
    label: item.label,
    url: mediaUrl,
    kind: "image",
    note: item.note || `Illustration originale, format 4:5. ${item.altText} Vérifier une dernière fois la justesse naturaliste et le texte avant diffusion.`,
    altText: item.altText,
    rightsStatus: item.rightsStatus || "original"
  };
  if (!existing.exists) {
    batch.set(reference, {
      ...contentFields,
      stage: item.stage || "proposal",
      publicationBlocked: item.publicationBlocked === true,
      archived: item.archived === true,
      authorUid: "system-seed",
      authorLabel: "Série éducative vintage",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "system-seed"
    }, { merge: true });
    created += 1;
  } else if (!sameSeedFields(existing.data(), contentFields)) {
    batch.set(reference, { ...contentFields, updatedAt: FieldValue.serverTimestamp(), updatedBy: "system-seed" }, { merge: true });
    updated += 1;
  } else {
    unchanged += 1;
  }
}

if (created + updated > 0) await batch.commit();
console.log(JSON.stringify({ seeded: true, media: manifest.length, created, updated, unchanged, writes: created + updated, events: new Set(manifest.map((item) => item.eventId)).size }, null, 2));
