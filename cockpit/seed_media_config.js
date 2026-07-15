import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { sameSeedFields } from "./seed_utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(here, "secrets", "media-config.json");
const dryRun = process.argv.includes("--dry-run");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));

function validSharePointUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase().endsWith(".sharepoint.com");
  } catch {
    return false;
  }
}

if (!validSharePointUrl(config.folderUrl) || !validSharePointUrl(config.folderViewUrl) || !validSharePointUrl(config.logoUrl)) {
  throw new Error("Les liens du dossier Media Cockpit doivent être des liens SharePoint HTTPS.");
}
if (!Array.isArray(config.initialMedia)) throw new Error("initialMedia doit être un tableau.");
for (const item of config.initialMedia) {
  if (!/^[a-z0-9-]{3,160}$/i.test(String(item.id || ""))) throw new Error("Identifiant média invalide.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(item.eventId || ""))) throw new Error("Événement média invalide.");
  if (!validSharePointUrl(item.url)) throw new Error("Lien média SharePoint invalide.");
}

if (dryRun) {
  console.log(JSON.stringify({ ready: true, initialMedia: config.initialMedia.length, configPath }, null, 2));
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers le compte de service Firebase privé.");
}

const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
const db = getFirestore(app);
const configReference = db.collection("privateConfig").doc("media");
const desiredConfig = {
  folderUrl: String(config.folderUrl).slice(0, 2048),
  folderViewUrl: String(config.folderViewUrl).slice(0, 2048),
  logoUrl: String(config.logoUrl).slice(0, 2048),
  provider: "sharepoint-onedrive"
};
const existingConfig = await configReference.get();
const configUpdated = !existingConfig.exists || !sameSeedFields(existingConfig.data(), desiredConfig);
if (configUpdated) await configReference.set({ ...desiredConfig, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

let created = 0;
let preserved = 0;
for (const item of config.initialMedia) {
  const reference = db.collection("mediaLinks").doc(item.id);
  const existing = await reference.get();
  if (existing.exists) {
    preserved += 1;
    continue;
  }
  await reference.set({
    eventId: item.eventId,
    label: String(item.label || "Média OneDrive").slice(0, 180),
    url: String(item.url).slice(0, 2048),
    kind: ["image", "video", "pdf", "document", "folder", "other"].includes(item.kind) ? item.kind : "other",
    stage: ["source", "draft", "approved", "published", "reference"].includes(item.stage) ? item.stage : "reference",
    note: String(item.note || "").slice(0, 1000),
    archived: false,
    authorUid: "system_seed",
    authorLabel: "Préparation locale",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "system_seed"
  });
  created += 1;
}

console.log(JSON.stringify({ seeded: true, configUpdated, created, preserved, writes: created + Number(configUpdated), total: config.initialMedia.length }, null, 2));
