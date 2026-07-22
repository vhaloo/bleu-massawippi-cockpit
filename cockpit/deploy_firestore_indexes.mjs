import fs from "node:fs";
import process from "node:process";
import { GoogleAuth } from "google-auth-library";

const projectId = process.argv.find((value) => value.startsWith("--project="))?.slice(10)
  || process.env.GCLOUD_PROJECT
  || process.env.GOOGLE_CLOUD_PROJECT;
const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm-no-delete");
if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId || "")) throw new Error("Projet Google Cloud requis avec --project=...");
if (apply && !confirmed) throw new Error("L’application exige --confirm-no-delete.");

const config = JSON.parse(fs.readFileSync(new URL("./firestore.indexes.json", import.meta.url), "utf8"));
const desired = Array.isArray(config.indexes) ? config.indexes : [];
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/datastore"] });
const client = await auth.getClient();
const authHeaders = await client.getRequestHeaders();
const headers = {
  ...(typeof authHeaders.entries === "function" ? Object.fromEntries(authHeaders.entries()) : authHeaders),
  "content-type": "application/json"
};
const database = `projects/${projectId}/databases/(default)`;
const base = "https://firestore.googleapis.com/v1";

function signature(index) {
  return JSON.stringify({
    queryScope: index.queryScope || "COLLECTION",
    fields: (index.fields || [])
      .filter(({ fieldPath }) => fieldPath !== "__name__")
      .map(({ fieldPath, order, arrayConfig }) => ({ fieldPath, order: order || "", arrayConfig: arrayConfig || "" }))
  });
}

const report = [];
for (const index of desired) {
  const group = String(index.collectionGroup || "");
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(group)) throw new Error(`Collection invalide : ${group}`);
  const endpoint = `${base}/${database}/collectionGroups/${encodeURIComponent(group)}/indexes`;
  const listed = await fetch(endpoint, { headers });
  if (!listed.ok) throw new Error(`Lecture des index ${group} refusée (${listed.status}) : ${(await listed.text()).slice(0, 500)}`);
  const current = (await listed.json()).indexes || [];
  const found = current.find((candidate) => signature(candidate) === signature(index));
  if (found) {
    report.push({ collectionGroup: group, action: "present", state: found.state || "UNKNOWN", name: found.name || "" });
    continue;
  }
  if (!apply) {
    report.push({ collectionGroup: group, action: "would-create", fields: index.fields });
    continue;
  }
  const created = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ queryScope: index.queryScope || "COLLECTION", fields: index.fields })
  });
  if (!created.ok) throw new Error(`Création de l’index ${group} refusée (${created.status}) : ${(await created.text()).slice(0, 500)}`);
  const operation = await created.json();
  report.push({ collectionGroup: group, action: "created", operation: operation.name || "" });
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", projectId, deletes: 0, report }, null, 2));
