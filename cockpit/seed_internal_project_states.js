import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service Firebase requis.");
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860";
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

const allowedStages = new Set(["to_frame", "planned", "active", "blocked", "completed"]);
const defaults = {
  "lamproie-du-nord": "blocked",
  "parc-lobadanaki": "active",
  "bilan-sante-lac": "active",
  "caracterisation-benthos": "to_frame",
  "surveillance-cyanobacteries": "to_frame",
  "technicien-un-jour": "to_frame",
  "jeux-provinciaux-peche": "blocked",
  "moules-zebrees-continuite": "blocked",
  "concours-dessin-jeunesse": "to_frame",
  "poesie-du-lac": "to_frame",
  "colloque-reseautage-associations": "to_frame",
  "concours-universitaire-bourse": "to_frame"
};

let created = 0;
let preserved = 0;
for (const [internalProjectId, stage] of Object.entries(defaults)) {
  if (!/^[a-z0-9-]{3,80}$/i.test(internalProjectId) || !allowedStages.has(stage)) {
    throw new Error(`État initial invalide pour ${internalProjectId}.`);
  }
  const reference = db.collection("internalProjectStates").doc(internalProjectId);
  const existing = await reference.get();
  if (existing.exists) {
    preserved += 1;
    continue;
  }
  await reference.set({
    projectId: internalProjectId,
    stage,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "system_seed",
    updatedByLabel: "État initial documenté"
  });
  created += 1;
}

console.log(JSON.stringify({ seeded: true, created, preserved, projects: Object.keys(defaults).length }, null, 2));
