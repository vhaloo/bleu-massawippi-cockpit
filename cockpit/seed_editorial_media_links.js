import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, "editorial_media_manifest.json"), "utf8"));
const linksPath = path.join(here, "secrets", "editorial-media-links.json");
if (!fs.existsSync(linksPath)) throw new Error("Le registre local secrets/editorial-media-links.json est requis et ne doit jamais être publié.");
const links = JSON.parse(fs.readFileSync(linksPath, "utf8"));
const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
const db = getFirestore(app);
const batch = db.batch();
let created = 0;
let updated = 0;

for (const item of manifest) {
  const url = links[item.fileName];
  if (!/^https:\/\/bleumassawippi\.sharepoint\.com\/:i:\/g\//.test(url || "")) throw new Error(`Lien SharePoint privé manquant pour ${item.fileName}.`);
  const reference = db.collection("mediaLinks").doc(item.id);
  const existing = await reference.get();
  const payload = {
    eventId: item.eventId, label: item.label, url, kind: "image", stage: "proposal",
    note: `Visuel original, format 4:5 (1080 × 1350). ${item.altText} Vérifier une dernière fois le texte et les faits avant diffusion.`,
    altText: item.altText, rightsStatus: "original", publicationBlocked: false, archived: false,
    authorUid: "system-seed", authorLabel: "Série éditoriale originale",
    updatedAt: FieldValue.serverTimestamp(), updatedBy: "system-seed"
  };
  if (!existing.exists) { payload.createdAt = FieldValue.serverTimestamp(); created += 1; } else { updated += 1; }
  batch.set(reference, payload, { merge: true });
}
await batch.commit();
console.log(JSON.stringify({ seeded: true, media: manifest.length, created, updated, events: new Set(manifest.map((item) => item.eventId)).size }, null, 2));
