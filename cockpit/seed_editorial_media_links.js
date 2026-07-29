import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { dryRunSummary, isDryRun, sameSeedFields } from "./seed_utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, "editorial_media_manifest.json"), "utf8"));
const eventFilter = process.argv.slice(2).find((arg) => arg.startsWith("--event="))?.slice("--event=".length).trim() || "";
const eventFilters = new Set(eventFilter.split(",").map((value) => value.trim()).filter(Boolean));
const mediaFilter = process.argv.slice(2).find((arg) => arg.startsWith("--media="))?.slice("--media=".length).trim() || "";
const selectedManifest = manifest.filter((item) => (!eventFilters.size || eventFilters.has(item.eventId)) && (!mediaFilter || item.id === mediaFilter));
if (!selectedManifest.length) throw new Error(`Aucun média éditorial trouvé pour le filtre demandé (${eventFilter || "tous les événements"}${mediaFilter ? `, ${mediaFilter}` : ""}).`);
const linksPath = path.join(here, "secrets", "editorial-media-links.json");
const requiresLinkRegistry = selectedManifest.some((item) => !item.reuseMediaId);
if (requiresLinkRegistry && !fs.existsSync(linksPath)) throw new Error("Le registre local secrets/editorial-media-links.json est requis et ne doit jamais être publié.");
const links = fs.existsSync(linksPath) ? JSON.parse(fs.readFileSync(linksPath, "utf8")) : {};
for (const item of selectedManifest) {
  if (!item.reuseMediaId && !/^https:\/\/bleumassawippi\.sharepoint\.com\/:(?:i|v):\/g\//.test(links[item.fileName] || "")) throw new Error(`Lien SharePoint privé manquant pour ${item.fileName}.`);
}
if (isDryRun()) {
  console.log(JSON.stringify(dryRunSummary("editorial-media", selectedManifest, { eventFilter: eventFilter || null, mediaFilter: mediaFilter || null, events: new Set(selectedManifest.map((item) => item.eventId)).size }), null, 2));
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
const db = getFirestore(app);
const batch = db.batch();
let created = 0;
let updated = 0;
let unchanged = 0;
const reusedUrls = new Map();

for (const item of selectedManifest) {
  let url = links[item.fileName];
  if (item.reuseMediaId) {
    if (!reusedUrls.has(item.reuseMediaId)) {
      const source = await db.collection("mediaLinks").doc(item.reuseMediaId).get();
      if (!source.exists) throw new Error(`Média source introuvable pour la réutilisation : ${item.reuseMediaId}.`);
      reusedUrls.set(item.reuseMediaId, source.data()?.url || "");
    }
    url = reusedUrls.get(item.reuseMediaId);
  }
  if (!/^https:\/\/bleumassawippi\.sharepoint\.com\/:(?:i|v):\/g\//.test(url || "")) throw new Error(`Lien SharePoint privé manquant pour ${item.fileName}.`);
  const reference = db.collection("mediaLinks").doc(item.id);
  const existing = await reference.get();
  const contentFields = {
    eventId: item.eventId, label: item.label, url, kind: item.kind || "image",
    note: item.note || `Visuel original, format 4:5 (1080 × 1350). ${item.altText} Vérifier une dernière fois le texte et les faits avant diffusion.`,
    altText: item.altText, rightsStatus: item.rightsStatus || "original",
    ...(item.previewUrl ? { previewUrl: item.previewUrl } : {})
  };
  const safetyFields = {
    ...(item.publicationBlocked === true ? { publicationBlocked: true } : {}),
    ...(item.archived === true ? { archived: true, selectedFinal: false } : {})
  };
  if (!existing.exists) {
    batch.set(reference, {
      ...contentFields, stage: item.stage || "proposal", publicationBlocked: item.publicationBlocked === true, archived: item.archived === true,
      authorUid: "system-seed", authorLabel: "Série éditoriale originale",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: "system-seed"
    }, { merge: true });
    created += 1;
  } else if (!sameSeedFields(existing.data(), { ...contentFields, ...safetyFields })) {
    batch.set(reference, { ...contentFields, ...safetyFields, updatedAt: FieldValue.serverTimestamp(), updatedBy: "system-seed" }, { merge: true });
    updated += 1;
  } else {
    unchanged += 1;
  }
}
if (created + updated > 0) await batch.commit();
console.log(JSON.stringify({ seeded: true, eventFilter: eventFilter || null, mediaFilter: mediaFilter || null, media: selectedManifest.length, created, updated, unchanged, writes: created + updated, reusedSourceReads: reusedUrls.size, events: new Set(selectedManifest.map((item) => item.eventId)).size }, null, 2));
