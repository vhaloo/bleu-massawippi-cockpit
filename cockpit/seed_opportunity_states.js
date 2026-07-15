import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { dryRunSummary, isDryRun } from "./seed_utils.js";

const defaults = {
  "nhsp-2026": "research",
  "td-fef-2026": "research",
  "fee-excellence-2026": "active",
  "ecoaction-freshwater": "watch",
  "hsp-species": "research",
  "fbfq-aqha-danger": "research",
  "echo-environment": "submitted",
  "wwf-tech-hub": "watch"
};
if (isDryRun()) {
  console.log(JSON.stringify(dryRunSummary("opportunity-states", Object.entries(defaults)), null, 2));
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service Firebase requis.");
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860";
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

let created = 0;
let preserved = 0;
for (const [opportunityId, stage] of Object.entries(defaults)) {
  const reference = db.collection("opportunityStates").doc(opportunityId);
  const existing = await reference.get();
  if (existing.exists) { preserved += 1; continue; }
  await reference.set({
    opportunityId,
    stage,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "system_seed",
    updatedByLabel: "État initial documenté"
  });
  created += 1;
}
console.log(JSON.stringify({ seeded: true, created, preserved, writes: created }, null, 2));
