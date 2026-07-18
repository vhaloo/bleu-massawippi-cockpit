#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  normalizePublicationDraft,
  publicationFromScheduleRow,
  publicationIdFrom,
  schedulePayloadFromDraft,
  validatePublicationDraft
} from "./publication-editor-schema.mjs";

const HELP = `
Studio local du Cockpit — publications structurées, versionnées et sans suppression.

Prérequis
  GOOGLE_APPLICATION_CREDENTIALS=C:\\chemin\\vers\\service-account.json
  COCKPIT_ADMIN_UID=<uid Valentin>                 (requis pour --apply, sauf --actor-uid)

Commandes de lecture (bornées)
  node publication_editor_cli.mjs list [--limit 30] [--from AAAA-MM-JJ] [--to AAAA-MM-JJ]
  node publication_editor_cli.mjs show --id ID
  node publication_editor_cli.mjs history --id ID [--limit 20]

Commandes de préparation (simulation par défaut)
  node publication_editor_cli.mjs create --file publication.json
  node publication_editor_cli.mjs update --file publication.json [--expected-revision N]
  node publication_editor_cli.mjs duplicate --id SOURCE --date AAAA-MM-JJ [--title TITRE] [--new-id ID]
  node publication_editor_cli.mjs reschedule --id ID --date AAAA-MM-JJ
  node publication_editor_cli.mjs restore --id ID --archive-id ARCHIVE_ID

Ajouter --apply pour écrire. Chaque écriture crée, dans la même transaction, une version
dans changeArchive. Il n’existe aucune commande de suppression.
`;

class CliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

function parseArgs(argv) {
  const values = new Map();
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }
    const [rawKey, inlineValue] = item.slice(2).split(/=(.*)/s, 2);
    if (!rawKey) throw new CliError("Option vide.");
    if (inlineValue !== undefined) values.set(rawKey, inlineValue);
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) values.set(rawKey, argv[++index]);
    else values.set(rawKey, "true");
  }
  return { command: positional[0] || "help", positional: positional.slice(1), values };
}

function option(args, name, fallback = "") {
  const value = args.values.get(name);
  return value === undefined ? fallback : String(value);
}

function booleanOption(args, name) {
  return ["true", "1", "yes", "oui"].includes(option(args, name).toLowerCase());
}

function integerOption(args, name, fallback, minimum, maximum) {
  const value = Number.parseInt(option(args, name, String(fallback)), 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new CliError(`--${name} doit être compris entre ${minimum} et ${maximum}.`);
  }
  return value;
}

function requireOption(args, name) {
  const value = option(args, name).trim();
  if (!value) throw new CliError(`--${name} est obligatoire.`);
  return value;
}

function validId(value, label = "identifiant") {
  const id = String(value || "").trim();
  if (!/^[a-z0-9-]{3,80}$/i.test(id)) throw new CliError(`${label} invalide.`);
  return id;
}

function validDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    throw new CliError("La date doit utiliser le format AAAA-MM-JJ.");
  }
  return date;
}

function jsonSafe(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function print(value) {
  process.stdout.write(`${JSON.stringify(jsonSafe(value), null, 2)}\n`);
}

function compactArchiveValue(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 5000) : item]));
}

function archiveEntry(entityId, action, before, after, actor, now) {
  return {
    entityType: "publicationContent",
    entityId: String(entityId).slice(0, 160),
    action: String(action || "publication modifiée").slice(0, 160),
    before: compactArchiveValue(before),
    after: compactArchiveValue(after),
    actorUid: actor.uid,
    actorLabel: actor.displayLabel.slice(0, 120),
    createdAt: now
  };
}

async function openDatabase(env = process.env) {
  const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST);
  if (!emulator && !env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new CliError("GOOGLE_APPLICATION_CREDENTIALS n’est pas défini. La clé doit rester hors du dépôt.");
  }
  const app = getApps().length ? getApp() : initializeApp({
    ...(emulator ? {} : { credential: applicationDefault() }),
    projectId: env.GOOGLE_CLOUD_PROJECT || (emulator ? "cockpit-editor-test" : undefined)
  });
  return getFirestore(app);
}

async function resolveActor(db, args, env = process.env) {
  const requestedUid = option(args, "actor-uid", env.COCKPIT_ADMIN_UID || "").trim();
  if (!requestedUid) {
    throw new CliError("--apply exige COCKPIT_ADMIN_UID ou --actor-uid. Aucun compte n’est deviné automatiquement.");
  }
  const snapshot = await db.collection("users").doc(requestedUid).get();
  if (!snapshot.exists) throw new CliError("Le profil de l’acteur n’existe pas.");
  const profile = snapshot.data();
  if (profile.role !== "admin" || profile.active !== true) {
    throw new CliError("L’acteur doit être un profil admin actif.");
  }
  return {
    uid: requestedUid,
    role: "admin",
    displayLabel: String(profile.displayLabel || "Communications")
  };
}

async function readDraftFile(fileName) {
  const absolutePath = path.resolve(process.cwd(), fileName);
  const text = await fs.readFile(absolutePath, "utf8");
  const value = JSON.parse(text);
  if (!value || Array.isArray(value) || typeof value !== "object") throw new CliError("Le fichier doit contenir un objet JSON.");
  return value;
}

async function getScheduleRow(db, id) {
  const snapshot = await db.collection("scheduleItems").doc(validId(id)).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function listRows(db, args) {
  const limit = integerOption(args, "limit", 30, 1, 100);
  const from = option(args, "from").trim();
  const to = option(args, "to").trim();
  let query = db.collection("scheduleItems").orderBy("dateIso", "asc");
  if (from) query = query.where("dateIso", ">=", validDate(from));
  if (to) query = query.where("dateIso", "<=", validDate(to));
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map((doc) => {
    const row = { id: doc.id, ...doc.data() };
    return {
      id: row.id,
      title: row.title || "",
      dateIso: row.dateIso || "",
      revision: Number(row.editorial?.revision || 0),
      theme: row.editorial?.theme || "",
      archivedEditorial: row.editorial?.archivedEditorial === true
    };
  });
}

async function readHistory(db, id, args) {
  const limit = integerOption(args, "limit", 20, 1, 40);
  const snapshot = await db.collection("changeArchive")
    .where("entityType", "==", "publicationContent")
    .where("entityId", "==", validId(id))
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function saveDraft(db, draft, args, action, { mustExist = null } = {}) {
  const errors = validatePublicationDraft(draft);
  if (errors.length) throw new CliError(errors.join(" "));
  const normalized = normalizePublicationDraft(draft);
  normalized.id = validId(normalized.id);
  const apply = booleanOption(args, "apply");
  const preflight = await getScheduleRow(db, normalized.id);
  if (mustExist === true && !preflight) throw new CliError("Cette publication n’existe pas.");
  if (mustExist === false && preflight) throw new CliError("Cet identifiant existe déjà.");
  const expectedRevision = option(args, "expected-revision").trim()
    ? integerOption(args, "expected-revision", 0, 0, 1000000)
    : Number(preflight?.editorial?.revision || 0);
  const previewPayload = schedulePayloadFromDraft(normalized, preflight || {});
  if (!apply) {
    return {
      mode: "dry-run",
      writes: 0,
      expectedRevision,
      publication: normalized,
      resultingRevision: previewPayload.editorial.revision,
      applyHint: "Relancez la même commande avec --apply après vérification."
    };
  }
  const actor = await resolveActor(db, args);
  const scheduleReference = db.collection("scheduleItems").doc(normalized.id);
  const archiveReference = db.collection("changeArchive").doc(`publication-${normalized.id}-${randomUUID()}`.slice(0, 160));
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(scheduleReference);
    if (mustExist === true && !snapshot.exists) throw new CliError("Cette publication n’existe plus.");
    if (mustExist === false && snapshot.exists) throw new CliError("Cet identifiant vient d’être utilisé.");
    const before = snapshot.exists ? snapshot.data() : {};
    const currentRevision = Number(before.editorial?.revision || 0);
    if (currentRevision !== expectedRevision) {
      throw new CliError(`Conflit de révision : attendu ${expectedRevision}, trouvé ${currentRevision}. Rechargez avant d’écrire.`);
    }
    const now = Timestamp.now();
    const payload = schedulePayloadFromDraft(normalized, before);
    const editorial = {
      ...payload.editorial,
      createdBy: before.editorial?.createdBy || actor.uid,
      createdAt: before.editorial?.createdAt || now
    };
    const after = { ...payload, editorial, updatedAt: now, updatedBy: actor.uid };
    transaction.set(scheduleReference, after, { merge: snapshot.exists });
    transaction.set(archiveReference, archiveEntry(normalized.id, action, before, after, actor, now));
    return { id: normalized.id, revision: editorial.revision, created: !snapshot.exists };
  });
  return { mode: "applied", writes: 2, ...result };
}

async function draftForCommand(db, args) {
  const command = args.command;
  if (["create", "update"].includes(command)) {
    return readDraftFile(requireOption(args, "file"));
  }
  const sourceId = validId(requireOption(args, "id"));
  const source = await getScheduleRow(db, sourceId);
  if (!source?.editorial) throw new CliError("La publication source n’a pas encore de contenu structuré dans le Studio.");
  if (command === "reschedule") {
    return { ...publicationFromScheduleRow(source), dateIso: validDate(requireOption(args, "date")) };
  }
  if (command === "duplicate") {
    const dateIso = validDate(requireOption(args, "date"));
    const title = option(args, "title", source.title).trim();
    const newId = option(args, "new-id").trim() || publicationIdFrom({ title, dateIso });
    return {
      ...publicationFromScheduleRow(source),
      id: validId(newId, "nouvel identifiant"),
      title,
      dateIso,
      originId: sourceId,
      archivedEditorial: false
    };
  }
  if (command === "restore") {
    const archiveId = requireOption(args, "archive-id");
    const snapshot = await db.collection("changeArchive").doc(archiveId).get();
    if (!snapshot.exists) throw new CliError("Cette version archivée n’existe pas.");
    const version = snapshot.data();
    if (version.entityType !== "publicationContent" || version.entityId !== sourceId || !version.after?.editorial) {
      throw new CliError("Cette archive ne correspond pas à la publication demandée.");
    }
    return { ...publicationFromScheduleRow({ id: sourceId, ...version.after }), id: sourceId };
  }
  throw new CliError(`Commande d’écriture inconnue : ${command}`);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (["help", "-h", "h"].includes(args.command) || args.values.has("help")) {
    process.stdout.write(HELP.trimStart());
    return;
  }
  const allowedCommands = new Set(["list", "show", "history", "create", "update", "duplicate", "reschedule", "restore"]);
  if (!allowedCommands.has(args.command)) throw new CliError(`Commande inconnue : ${args.command}`);
  const db = await openDatabase(env);
  if (args.command === "list") return print({ mode: "read-only", rows: await listRows(db, args) });
  if (args.command === "show") {
    const row = await getScheduleRow(db, requireOption(args, "id"));
    if (!row) throw new CliError("Cette publication n’existe pas.");
    return print({ mode: "read-only", row, publication: row.editorial ? publicationFromScheduleRow(row) : null });
  }
  if (args.command === "history") {
    return print({ mode: "read-only", rows: await readHistory(db, requireOption(args, "id"), args) });
  }
  const draft = await draftForCommand(db, args);
  const actions = {
    create: "publication créée depuis l’outil local",
    update: "publication modifiée depuis l’outil local",
    duplicate: "publication dupliquée depuis l’outil local",
    reschedule: "publication reprogrammée depuis l’outil local",
    restore: "version restaurée depuis l’outil local"
  };
  const constraints = args.command === "create" || args.command === "duplicate"
    ? { mustExist: false }
    : { mustExist: true };
  print(await saveDraft(db, draft, args, actions[args.command], constraints));
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  main().catch((error) => {
    console.error(String(error?.message || error || "Erreur inconnue"));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  });
}
