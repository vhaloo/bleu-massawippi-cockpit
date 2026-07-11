import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service Firebase requis.");
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860";
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
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
console.log(JSON.stringify({ seeded: true, created, preserved }, null, 2));
