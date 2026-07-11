import fs from "node:fs/promises";
import { applicationDefault, initializeApp } from "firebase-admin/app";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860";
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service Firebase requis.");
const app = initializeApp({ credential: applicationDefault(), projectId });
const token = (await app.options.credential.getAccessToken()).access_token;
const content = await fs.readFile(new URL("./firestore.rules", import.meta.url), "utf8");
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const created = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
  method: "POST", headers, body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content }] } })
});
if (!created.ok) throw new Error(`Création des règles refusée (${created.status}) : ${await created.text()}`);
const ruleset = await created.json();
const release = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, {
  method: "PATCH", headers, body: JSON.stringify({
    release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: ruleset.name },
    updateMask: "rulesetName"
  })
});
if (!release.ok) throw new Error(`Publication des règles refusée (${release.status}) : ${await release.text()}`);
console.log(JSON.stringify({ published: true, ruleset: ruleset.name }, null, 2));
