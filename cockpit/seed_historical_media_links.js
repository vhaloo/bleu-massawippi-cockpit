import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
}

const here = path.dirname(fileURLToPath(import.meta.url));
const media = JSON.parse(fs.readFileSync(path.join(here, "historical_media_manifest.json"), "utf8"));
const privateLinksPath = path.join(here, "secrets", "historical-media-links.json");
if (!fs.existsSync(privateLinksPath)) {
  throw new Error("Le registre local secrets/historical-media-links.json est requis et ne doit jamais être publié.");
}
const privateLinks = JSON.parse(fs.readFileSync(privateLinksPath, "utf8"));
const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
const db = getFirestore(app);
const batch = db.batch();
let created = 0;
let updated = 0;

for (const item of media) {
  const mediaUrl = privateLinks[item.fileName];
  if (!/^https:\/\/bleumassawippi\.sharepoint\.com\/:i:\/g\//.test(mediaUrl || "")) {
    throw new Error(`Lien SharePoint privé manquant pour ${item.fileName}.`);
  }
  const reference = db.collection("mediaLinks").doc(item.id);
  const existing = await reference.get();
  const rightsUnconfirmed = /confirmer/i.test(item.license || "") || /ne pas publier/i.test(item.publicationStatus || "");
  const rightsLabel = rightsUnconfirmed ? "⚠ DROITS À CONFIRMER — référence interne; ne pas publier avant autorisation écrite." : item.publicationStatus;
  const contentFields = {
    eventId: item.eventId, label: item.label, url: mediaUrl, kind: "image",
    note: `${rightsLabel} Crédit : ${item.author}. Licence : ${item.license}. Période : ${item.period}. Source documentaire : ${item.source}`,
    rightsStatus: rightsUnconfirmed ? "unconfirmed" : "documented"
  };
  if (!existing.exists) {
    batch.set(reference, {
      ...contentFields, stage: "source", publicationBlocked: rightsUnconfirmed,
      archived: false, authorUid: "system-seed", authorLabel: "Banque historique documentée",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: "system-seed"
    }, { merge: true });
    created += 1;
  } else {
    batch.set(reference, contentFields, { merge: true });
    updated += 1;
  }
}

await batch.commit();
console.log(JSON.stringify({ seeded: true, media: media.length, created, updated, rightsUnconfirmed: media.filter((item) => /confirmer/i.test(item.license || "")).length, events: [...new Set(media.map((item) => item.eventId))].length }, null, 2));
