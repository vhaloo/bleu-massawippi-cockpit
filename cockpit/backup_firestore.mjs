#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { encodeBackupValue } from "./firestore_backup_codec.mjs";

const SHA256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const slug = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

function parseArgs(argv) {
  const args = new Map();
  for (const token of argv) {
    const match = token.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) throw new Error(`Argument invalide : ${token}`);
    args.set(match[1], match[2] ?? true);
  }
  return args;
}

async function writeExclusive(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, { encoding: "utf8", flag: "wx" });
  return { path: path.basename(file), bytes: Buffer.byteLength(content), sha256: SHA256(content) };
}

async function uniqueDirectory(root, prefix) {
  await fs.mkdir(root, { recursive: true });
  for (let index = 0; index < 1000; index += 1) {
    const candidate = path.join(root, index ? `${prefix}-${String(index).padStart(3, "0")}` : prefix);
    try {
      await fs.mkdir(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  throw new Error("Impossible de réserver un dossier de sauvegarde unique.");
}

export async function collectFirestoreDocuments(db) {
  const pending = (await db.listCollections()).sort((a, b) => a.path.localeCompare(b.path));
  const seen = new Set();
  const documents = [];
  const collections = [];
  while (pending.length) {
    const collection = pending.shift();
    if (seen.has(collection.path)) continue;
    seen.add(collection.path);
    const snapshot = await collection.get();
    collections.push({ path: collection.path, documentCount: snapshot.size });
    for (const document of snapshot.docs) {
      documents.push({ path: document.ref.path, data: encodeBackupValue(document.data()) });
      const children = await document.ref.listCollections();
      pending.push(...children.sort((a, b) => a.path.localeCompare(b.path)));
    }
    pending.sort((a, b) => a.path.localeCompare(b.path));
  }
  documents.sort((a, b) => a.path.localeCompare(b.path));
  collections.sort((a, b) => a.path.localeCompare(b.path));
  return { documents, collections };
}

export async function createBackup({ db, projectId, outputRoot, now = new Date() }) {
  const directory = await uniqueDirectory(outputRoot, `disaster-backup-${slug(now)}`);
  const marker = path.join(directory, "BACKUP_IN_PROGRESS.json");
  await writeExclusive(marker, `${JSON.stringify({ status: "in-progress", createdAt: now.toISOString(), projectId }, null, 2)}\n`);
  try {
    const { documents, collections } = await collectFirestoreDocuments(db);
    const ndjson = `${documents.map((document) => JSON.stringify(document)).join("\n")}\n`;
    const dataFile = await writeExclusive(path.join(directory, "documents.ndjson"), ndjson);
    const summaryPayload = {
      schemaVersion: 1,
      format: "cockpit-firestore-logical-backup",
      createdAt: now.toISOString(),
      projectId,
      databaseId: "(default)",
      documentCount: documents.length,
      collectionCount: collections.length,
      collections,
      includesSubcollections: true,
      credentialFilesIncluded: false,
      environmentValuesIncluded: false
    };
    const summary = await writeExclusive(path.join(directory, "backup-summary.json"), `${JSON.stringify(summaryPayload, null, 2)}\n`);
    const manifestPayload = { schemaVersion: 1, algorithm: "SHA-256", files: [dataFile, summary] };
    const manifestText = `${JSON.stringify(manifestPayload, null, 2)}\n`;
    const manifest = await writeExclusive(path.join(directory, "manifest.json"), manifestText);
    await writeExclusive(path.join(directory, "manifest.sha256"), `${manifest.sha256}  manifest.json\n`);
    await writeExclusive(path.join(directory, "BACKUP_COMPLETE.json"), `${JSON.stringify({ status: "complete", completedAt: new Date().toISOString(), manifestSha256: manifest.sha256 }, null, 2)}\n`);
    await fs.unlink(marker);
    return { directory, ...summaryPayload, manifestSha256: manifest.sha256 };
  } catch (error) {
    await fs.writeFile(path.join(directory, "BACKUP_INCOMPLETE.json"), `${JSON.stringify({ status: "incomplete", message: String(error?.message || error) }, null, 2)}\n`, "utf8");
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("help")) {
    console.log("Usage: node backup_firestore.mjs [--output=CHEMIN]\nCrée une sauvegarde logique complète, y compris les sous-collections. Cette commande lit chaque document une fois.");
    return;
  }
  const unknown = [...args.keys()].filter((key) => !["help", "output"].includes(key));
  if (unknown.length) throw new Error(`Option inconnue : --${unknown.join(", --")}`);
  const app = getApps().length ? getApp() : initializeApp({ credential: applicationDefault() });
  const db = getFirestore(app);
  const projectId = app.options.projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || await app.options.credential?.getProjectId?.();
  if (!projectId) throw new Error("Project ID Firebase introuvable.");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outputRoot = path.resolve(here, String(args.get("output") || "sync-output"));
  const result = await createBackup({ db, projectId, outputRoot });
  console.log(JSON.stringify({ mode: "disaster-backup", ...result }, null, 2));
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
