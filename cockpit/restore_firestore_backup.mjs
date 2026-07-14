#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { GeoPoint, Timestamp, getFirestore } from "firebase-admin/firestore";
import { decodeBackupValue } from "./firestore_backup_codec.mjs";

const SHA256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function parseArgs(argv) {
  const args = new Map();
  for (const token of argv) {
    const match = token.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) throw new Error(`Argument invalide : ${token}`);
    args.set(match[1], match[2] ?? true);
  }
  return args;
}

export async function verifyBackup(directory) {
  const complete = JSON.parse(await fs.readFile(path.join(directory, "BACKUP_COMPLETE.json"), "utf8"));
  const manifestText = await fs.readFile(path.join(directory, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  const manifestHash = SHA256(manifestText);
  if (manifestHash !== complete.manifestSha256) throw new Error("Empreinte du manifeste invalide.");
  for (const file of manifest.files) {
    const content = await fs.readFile(path.join(directory, file.path));
    if (SHA256(content) !== file.sha256 || content.byteLength !== file.bytes) throw new Error(`Fichier altéré : ${file.path}`);
  }
  const summary = JSON.parse(await fs.readFile(path.join(directory, "backup-summary.json"), "utf8"));
  const lines = (await fs.readFile(path.join(directory, "documents.ndjson"), "utf8")).split(/\r?\n/).filter(Boolean);
  const documents = lines.map((line) => JSON.parse(line));
  if (documents.length !== summary.documentCount) throw new Error("Nombre de documents incohérent.");
  return { manifest, summary, documents };
}

export async function restoreDocuments({ db, documents, apply = false, batchSize = 200 }) {
  const invalid = documents.filter((document) => !/^[^/]+\/[^/]+(?:\/[^/]+\/[^/]+)*$/.test(document.path));
  if (invalid.length) throw new Error(`Chemin Firestore invalide : ${invalid[0].path}`);
  if (!apply) return { mode: "dry-run", documentCount: documents.length, writes: 0, batches: 0 };
  let writes = 0;
  let batches = 0;
  for (let offset = 0; offset < documents.length; offset += batchSize) {
    const batch = db.batch();
    for (const document of documents.slice(offset, offset + batchSize)) {
      const data = decodeBackupValue(document.data, { Timestamp, GeoPoint, db });
      batch.set(db.doc(document.path), data, { merge: false });
      writes += 1;
    }
    await batch.commit();
    batches += 1;
  }
  return { mode: "apply", documentCount: documents.length, writes, batches };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("help") || !args.has("backup")) {
    console.log("Usage: node restore_firestore_backup.mjs --backup=CHEMIN [--apply] [--allow-production --expected-project-id=ID --confirm-document-count=N]\nSans --apply, vérifie seulement la sauvegarde. L'application directe est permise sur Emulator; la production exige trois confirmations concordantes.");
    return;
  }
  const unknown = [...args.keys()].filter((key) => !["help", "backup", "apply", "allow-production", "expected-project-id", "confirm-document-count"].includes(key));
  if (unknown.length) throw new Error(`Option inconnue : --${unknown.join(", --")}`);
  const directory = path.resolve(String(args.get("backup")));
  const verified = await verifyBackup(directory);
  const apply = args.get("apply") === true || args.get("apply") === "true";
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", backup: directory, projectId: verified.summary.projectId, documentCount: verified.documents.length, integrity: "verified" }, null, 2));
    return;
  }
  if (!emulator) {
    const confirmed = args.get("allow-production") === true
      && String(args.get("expected-project-id") || "") === verified.summary.projectId
      && Number(args.get("confirm-document-count")) === verified.documents.length;
    if (!confirmed) throw new Error("Restauration hors Emulator refusée : confirmations de production absentes ou incohérentes.");
  }
  const app = getApps().length ? getApp() : initializeApp(emulator ? { projectId: verified.summary.projectId } : { credential: applicationDefault() });
  const db = getFirestore(app);
  const targetProjectId = app.options.projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || await app.options.credential?.getProjectId?.();
  if (!emulator && targetProjectId !== verified.summary.projectId) throw new Error("Le projet cible ne correspond pas au projet de la sauvegarde.");
  const result = await restoreDocuments({ db, documents: verified.documents, apply: true });
  console.log(JSON.stringify({ ...result, target: emulator ? "emulator" : targetProjectId, integrity: "verified", deletionCount: 0 }, null, 2));
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
