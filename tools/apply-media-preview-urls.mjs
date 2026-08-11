import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = "bleu-massawippi-cockpit-5d860";
const DATABASE = "(default)";
const APPLY = process.argv.includes("--apply");
const root = path.resolve(import.meta.dirname, "..");
const mappingPath = path.join(root, "tools", "data", "future-media-preview-urls-20260811.json");
const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
const publicPrefix = "https://vhaloo.github.io/bleu-massawippi-cockpit/";

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!config.tokens?.access_token || Number(config.tokens.expires_at || 0) < Date.now() + 120_000) {
  throw new Error("Session Firebase CLI expirée; la renouveler avant cette mise à jour ciblée.");
}
const token = config.tokens.access_token;
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}`;
const documentRoot = `projects/${PROJECT_ID}/databases/${DATABASE}/documents`;

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;
  return { ok: response.ok, status: response.status, body };
}

function stringField(document, field) {
  return document?.fields?.[field]?.stringValue || "";
}

const mappings = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
if (!Array.isArray(mappings) || !mappings.length) throw new Error("Manifeste d’aperçus vide ou invalide.");
if (new Set(mappings.map((item) => item.id)).size !== mappings.length) throw new Error("Identifiants d’aperçus dupliqués.");
for (const item of mappings) {
  if (!/^[A-Za-z0-9_-]+$/.test(item.id || "")) throw new Error(`Identifiant média invalide : ${item.id || "vide"}.`);
  if (!String(item.previewUrl || "").startsWith(publicPrefix)) throw new Error(`URL d’aperçu hors dépôt : ${item.id}.`);
  const relative = item.previewUrl.slice(publicPrefix.length).replaceAll("/", path.sep);
  if (!fs.existsSync(path.join(root, "cockpit", relative))) throw new Error(`Fichier d’aperçu absent : ${relative}.`);
}

const changes = [];
const preserved = [];
for (const item of mappings) {
  const result = await request(`${base}/documents/mediaLinks/${item.id}`);
  if (!result.ok) throw new Error(`Média Firestore introuvable ou illisible (${item.id}, ${result.status}).`);
  const before = stringField(result.body, "previewUrl");
  if (before && before !== item.previewUrl) {
    throw new Error(`Conflit ${item.id} : un autre aperçu est déjà enregistré; aucune écriture effectuée.`);
  }
  if (before === item.previewUrl) preserved.push(item.id);
  else changes.push({ ...item, updateTime: result.body.updateTime, before });
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  reads: mappings.length,
  candidates: changes.length,
  preserved: preserved.length,
  writesPlanned: changes.length * 2,
  ids: changes.map((item) => item.id)
}, null, 2));
if (!APPLY || !changes.length) process.exitCode = 0;
else {
  const writes = [];
  for (const item of changes) {
    writes.push({
      update: {
        name: `${documentRoot}/mediaLinks/${item.id}`,
        fields: { previewUrl: { stringValue: item.previewUrl } }
      },
      updateMask: { fieldPaths: ["previewUrl"] },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { updateTime: item.updateTime }
    });
    writes.push({
      update: {
        name: `${documentRoot}/changeArchive/media-preview-url-20260811-${item.id}`,
        fields: {
          entityType: { stringValue: "mediaLink" },
          entityId: { stringValue: item.id },
          action: { stringValue: "ajout d’un aperçu GitHub dédié sans modification du média original" },
          before: { mapValue: { fields: { previewUrl: { stringValue: item.before } } } },
          after: { mapValue: { fields: { previewUrl: { stringValue: item.previewUrl } } } },
          actorUid: { stringValue: "6FAy9GJU5qTUlHNelXvtHBsVH3k1" },
          actorLabel: { stringValue: "Valentin Wittwe" }
        }
      },
      updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false }
    });
  }
  const result = await request(`${base}/documents:commit`, { method: "POST", body: JSON.stringify({ writes }) });
  if (!result.ok) throw new Error(`Commit Firestore refusé (${result.status}): ${JSON.stringify(result.body)}`);
  console.log(JSON.stringify({ applied: true, mediaUpdated: changes.length, writes: writes.length, commitTime: result.body.commitTime }, null, 2));
}
