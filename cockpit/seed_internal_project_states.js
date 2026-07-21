import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { dryRunSummary, isDryRun } from "./seed_utils.js";

const allowedStages = new Set(["to_frame", "planned", "active", "blocked", "completed"]);
const defaults = {
  "lamproie-du-nord": "blocked",
  "application-carte-vivante-lac": "to_frame",
  "parc-lobadanaki": "active",
  "bilan-sante-lac": "active",
  "caracterisation-benthos": "to_frame",
  "surveillance-cyanobacteries": "to_frame",
  "technicien-un-jour": "to_frame",
  "jeux-provinciaux-peche": "completed",
  "moules-zebrees-continuite": "blocked",
  "concours-dessin-jeunesse": "planned",
  "poesie-du-lac": "to_frame",
  "fonds-environnemental-partenarial": "to_frame",
  "colloque-reseautage-associations": "to_frame",
  "concours-universitaire-bourse": "to_frame",
  "participation-photo-regards-massawippi": "to_frame"
};
const projectFilter = process.argv.slice(2).find((arg) => arg.startsWith("--project="))?.slice("--project=".length).trim() || "";
const selectedDefaults = Object.entries(defaults).filter(([internalProjectId]) => !projectFilter || internalProjectId === projectFilter);

for (const [internalProjectId, stage] of Object.entries(defaults)) if (!/^[a-z0-9-]{3,80}$/i.test(internalProjectId) || !allowedStages.has(stage)) throw new Error(`État initial invalide pour ${internalProjectId}.`);
if (!selectedDefaults.length) throw new Error(`Projet interne introuvable : ${projectFilter || "filtre vide"}.`);
if (isDryRun()) {
  console.log(JSON.stringify(dryRunSummary("internal-project-states", selectedDefaults, { projectFilter: projectFilter || null }), null, 2));
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service Firebase requis.");
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "bleu-massawippi-cockpit-5d860";
const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

let created = 0;
let preserved = 0;
for (const [internalProjectId, stage] of selectedDefaults) {
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

console.log(JSON.stringify({ seeded: true, projectFilter: projectFilter || null, created, preserved, writes: created, projects: selectedDefaults.length }, null, 2));
