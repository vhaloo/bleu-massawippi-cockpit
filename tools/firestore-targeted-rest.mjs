import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const DATABASE = "(default)";
const CONFIG_PATH = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");

function usage(message = "") {
  if (message) console.error(message);
  console.error("Usage: node tools/firestore-targeted-rest.mjs get collection/id");
  console.error("       node tools/firestore-targeted-rest.mjs query collection field value [limit]");
  console.error("       node tools/firestore-targeted-rest.mjs create collection/id payload.json");
  process.exit(2);
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function accessToken() {
  const config = readConfig();
  if (!config.tokens?.access_token || Number(config.tokens.expires_at || 0) < Date.now() + 120_000) {
    throw new Error("Session Firebase CLI expirée; exécuter d’abord `npx firebase-tools projects:list --json` pour la renouveler sans afficher de jeton.");
  }
  return config.tokens.access_token;
}

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object" && value.$timestamp === "now") return { timestampValue: new Date().toISOString() };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)])) } };
  }
  throw new Error(`Type non pris en charge : ${typeof value}`);
}

function decode(value = {}) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decode(child)]));
  return undefined;
}

function decodeDocument(document) {
  if (!document) return null;
  return {
    id: String(document.name || "").split("/").at(-1),
    createTime: document.createTime,
    updateTime: document.updateTime,
    ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]))
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;
  return { ok: response.ok, status: response.status, body: parsed };
}

const [command, ...args] = process.argv.slice(2);
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}`;

if (command === "get") {
  const [target] = args;
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(target || "")) usage("Cible get invalide.");
  const result = await request(`${base}/documents/${target}`);
  if (result.status === 404) {
    console.log(JSON.stringify({ found: false, target }));
    process.exit(0);
  }
  if (!result.ok) throw new Error(`Lecture Firestore refusée (${result.status}).`);
  console.log(JSON.stringify({ found: true, document: decodeDocument(result.body) }, null, 2));
  process.exit(0);
}

if (command === "query") {
  const [collection, field, value, rawLimit = "40"] = args;
  const limit = Math.min(40, Math.max(1, Number(rawLimit) || 40));
  if (!/^[A-Za-z0-9_-]+$/.test(collection || "") || !/^[A-Za-z0-9_-]+$/.test(field || "")) usage("Requête invalide.");
  const result = await request(`${base}/documents:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: collection }],
      where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: encode(value) } },
      limit
    } })
  });
  if (!result.ok) throw new Error(`Requête Firestore refusée (${result.status}).`);
  const documents = (result.body || []).map((row) => row.document).filter(Boolean).map(decodeDocument);
  console.log(JSON.stringify({ collection, field, value, limit, count: documents.length, documents }, null, 2));
  process.exit(0);
}

if (command === "create") {
  const [target, payloadPath] = args;
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(target || "")) usage("Cible create invalide.");
  if (!payloadPath || !fs.existsSync(payloadPath)) usage("Payload JSON introuvable.");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const fields = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, encode(value)]));
  const url = new URL(`${base}/documents/${target}`);
  url.searchParams.set("currentDocument.exists", "false");
  const result = await request(url, { method: "PATCH", body: JSON.stringify({ fields }) });
  if (result.status === 409 || result.status === 412) {
    console.log(JSON.stringify({ created: false, reason: "already-exists", target }));
    process.exit(3);
  }
  if (!result.ok) throw new Error(`Création Firestore refusée (${result.status}).`);
  console.log(JSON.stringify({ created: true, document: decodeDocument(result.body) }, null, 2));
  process.exit(0);
}

usage("Commande inconnue.");
