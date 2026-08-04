import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const ACTION_ID = "project-decision-site-niveau-lac-rapport-2025-v1";
const TARGET_TYPE = "section";
const TARGET_ID = "site-niveau-lac-rapport-2025";
const MUTATION_ID = "repair-level-lake-navigation-20260804-v1";
const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-level-lake-routing");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-level-lake-routing après vérification du dry-run.");

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
const alreadyCorrect = initial.sourceType === TARGET_TYPE && initial.sourceId === TARGET_ID;
if (initialArchive.exists && !alreadyCorrect) {
  throw new Error("L’archive du correctif existe, mais la cible est différente : intervention manuelle requise.");
}
if (initial.state !== "pending" && !alreadyCorrect) {
  throw new Error(`La décision n’est plus en attente (${initial.state || "état absent"}); aucune cible ne sera modifiée.`);
}
if (initial.createdByUid !== "system_project_decision" && !alreadyCorrect) {
  throw new Error("La décision n’appartient pas au générateur de décisions de projet; aucune écriture automatique.");
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  actionId: ACTION_ID,
  state: initial.state,
  before: { sourceType: initial.sourceType, sourceId: initial.sourceId },
  after: { sourceType: TARGET_TYPE, sourceId: TARGET_ID },
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
    const now = Timestamp.now();
    const after = {
      ...before,
      sourceType: TARGET_TYPE,
      sourceId: TARGET_ID,
      updatedAt: now,
      updatedBy: actor.uid,
      lastMutationId: MUTATION_ID
    };
    transaction.set(actionRef, after);
    transaction.set(archiveRef, {
      entityType: "projectDecisionNavigation",
      entityId: ACTION_ID,
      action: "cible Niveau du lac réparée sans modifier la décision",
      before: { actionItem: before },
      after: { actionItem: after },
      actorUid: actor.uid,
      actorLabel,
      createdAt: FieldValue.serverTimestamp()
    });
  });
  console.log("Cible Niveau du lac réparée avec archive avant/après.");
}

await deleteApp(app);
