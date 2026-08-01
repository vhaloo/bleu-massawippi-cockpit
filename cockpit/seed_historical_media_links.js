import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { dryRunSummary, isDryRun, sameSeedFields } from "./seed_utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, "historical_media_manifest.json"), "utf8"));
const eventFilter = process.argv.slice(2).find((arg) => arg.startsWith("--event="))?.slice("--event=".length).trim() || "";
const eventFilters = new Set(eventFilter.split(",").map((value) => value.trim()).filter(Boolean));
const mediaFilter = process.argv.slice(2).find((arg) => arg.startsWith("--media="))?.slice("--media=".length).trim() || "";
const media = manifest.filter((item) => (!eventFilters.size || eventFilters.has(item.eventId)) && (!mediaFilter || item.id === mediaFilter));
if (!media.length) throw new Error(`Aucun média historique trouvé pour le filtre demandé (${eventFilter || "tous les événements"}${mediaFilter ? `, ${mediaFilter}` : ""}).`);
const privateLinksPath = path.join(here, "secrets", "historical-media-links.json");
if (!fs.existsSync(privateLinksPath)) {
  throw new Error("Le registre local secrets/historical-media-links.json est requis et ne doit jamais être publié.");
}
const privateLinks = JSON.parse(fs.readFileSync(privateLinksPath, "utf8"));
for (const item of media) if (!/^https:\/\/bleumassawippi\.sharepoint\.com\/:i:\/g\//.test(privateLinks[item.fileName] || "")) throw new Error(`Lien SharePoint privé manquant pour ${item.fileName}.`);
if (isDryRun()) {
  console.log(JSON.stringify(dryRunSummary("historical-media", media, { eventFilter: eventFilter || null, mediaFilter: mediaFilter || null, events: new Set(media.map((item) => item.eventId)).size }), null, 2));
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
const db = getFirestore(app);
const batch = db.batch();
let created = 0;
let updated = 0;
let unchanged = 0;

for (const item of media) {
  const mediaUrl = privateLinks[item.fileName];
  if (!/^https:\/\/bleumassawippi\.sharepoint\.com\/:i:\/g\//.test(mediaUrl || "")) {
    throw new Error(`Lien SharePoint privé manquant pour ${item.fileName}.`);
  }
  const reference = db.collection("mediaLinks").doc(item.id);
  const existing = await reference.get();
  const rightsUnconfirmed = /confirmer/i.test(item.license || "") || /ne pas publier/i.test(item.publicationStatus || "");
  const rightsLabel = rightsUnconfirmed ? "⚠ DROITS À CONFIRMER — référence interne; ne pas publier avant autorisation écrite." : item.publicationStatus;
  const enforcedArchiveFields = item.archived === true ? {
    stage: "reference",
    archived: true,
    publicationBlocked: true,
    selectedFinal: false
  } : {};
  const contentFields = {
    eventId: item.eventId, label: item.label, url: mediaUrl, kind: "image",
    note: `${item.note ? `${item.note} ` : ""}${rightsLabel} Crédit : ${item.author}. Licence : ${item.license}. Période : ${item.period}. Source documentaire : ${item.source}`,
    rightsStatus: rightsUnconfirmed ? "unconfirmed" : "documented",
    ...enforcedArchiveFields
  };
  if (!existing.exists) {
    batch.set(reference, {
      ...contentFields, stage: item.stage || "source", publicationBlocked: rightsUnconfirmed || item.publicationBlocked === true,
      archived: item.archived === true, authorUid: "system-seed", authorLabel: "Banque historique documentée",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: "system-seed"
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
console.log(JSON.stringify({ seeded: true, eventFilter: eventFilter || null, mediaFilter: mediaFilter || null, media: media.length, created, updated, unchanged, writes: created + updated, rightsUnconfirmed: media.filter((item) => /confirmer/i.test(item.license || "")).length, events: [...new Set(media.map((item) => item.eventId))].length }, null, 2));
