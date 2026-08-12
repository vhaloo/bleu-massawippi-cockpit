import process from "node:process";
import { readFileSync } from "node:fs";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DECISION_ID = "site-niveau-lac-rapport-2025-v1";
const ACTION_ID = `project-decision-${DECISION_ID}`;
const MUTATION_ID = "reconcile-level-lake-content-20260812-v2";
const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-level-lake-content");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-level-lake-content après vérification du dry-run.");

const manifest = JSON.parse(readFileSync(new URL("./project_decisions.json", import.meta.url), "utf8"));
const decision = manifest.decisions.find((item) => item.id === DECISION_ID);
if (!decision) throw new Error("Décision Niveau du lac absente du manifeste local.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const actionRef = db.doc(`actionItems/${ACTION_ID}`);
const archiveRef = db.doc(`changeArchive/${MUTATION_ID}`);
const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);

const [initialAction, initialArchive] = await Promise.all([actionRef.get(), archiveRef.get()]);
if (!initialAction.exists) throw new Error(`Décision personnelle introuvable : ${ACTION_ID}.`);
const initial = initialAction.data();
const alreadyCorrect = initial.title === decision.title && initial.message === decision.message;
if (initialArchive.exists && !alreadyCorrect) {
  throw new Error("L’archive du correctif existe, mais le texte diffère : intervention manuelle requise.");
}
if (initial.state !== "pending" && !alreadyCorrect) {
  throw new Error(`La décision n’est plus en attente (${initial.state || "état absent"}); aucune donnée ne sera modifiée.`);
}
if (initial.createdByUid !== "system_project_decision" && !alreadyCorrect) {
  throw new Error("La décision n’appartient pas au générateur de décisions de projet; aucune écriture automatique.");
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  actionId: ACTION_ID,
  state: initial.state,
  before: { title: initial.title, message: initial.message },
  after: { title: decision.title, message: decision.message },
  alreadyCorrect,
  archived: initialArchive.exists,
  maximumReads: 4,
  maximumWrites: alreadyCorrect ? 0 : 2
}, null, 2));

if (APPLY && !alreadyCorrect) {
  await db.runTransaction(async (transaction) => {
    const [currentAction, currentArchive] = await Promise.all([
      transaction.get(actionRef),
      transaction.get(archiveRef)
    ]);
    if (currentArchive.exists) return;
    if (!currentAction.exists || !initialAction.updateTime.isEqual(currentAction.updateTime)) {
      throw new Error("La décision a changé depuis le dry-run; relire au lieu d’écraser l’interaction récente.");
    }
    const before = currentAction.data();
    if (before.state !== "pending" || before.createdByUid !== "system_project_decision") {
      throw new Error("La décision n’est plus dans l’état sûr attendu; aucune donnée n’a été modifiée.");
    }
    const after = {
      ...before,
      title: decision.title,
      message: decision.message,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      lastMutationId: MUTATION_ID
    };
    transaction.set(actionRef, after);
    transaction.set(archiveRef, {
      entityType: "projectDecisionContent",
      entityId: ACTION_ID,
      action: "attribution du rapport Niveau du lac corrigée après vérification du rapport officiel",
      before: { actionItem: before },
      after: { actionItem: after },
      actorUid: actor.uid,
      actorLabel,
      createdAt: FieldValue.serverTimestamp()
    });
  });
  console.log("Consigne Niveau du lac actualisée avec archive avant/après.");
}

await deleteApp(app);
