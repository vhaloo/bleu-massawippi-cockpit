import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm-editorial-reconciliation");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (apply && !confirm) throw new Error("Relancer avec --apply --confirm-editorial-reconciliation après vérification du dry-run.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);

const operations = [
  {
    eventId: "alt-20260810",
    taskId: "editorial-alt-20260810",
    archiveId: "editorial-archive-alt-20260810-20260729",
    expectedDecision: "rejected",
    nextDecision: "rejected",
    targetLabel: "Archive éditoriale · North Hatley, un été d’autrefois",
    action: "angle éditorial rejeté classé sans suppression",
    completionReason: "Angle écarté par la direction et conservé dans les archives éditoriales; aucune publication ne sera programmée sans nouvelle discussion."
  },
  {
    eventId: "alt-20260807",
    taskId: "editorial-alt-20260807",
    archiveId: "editorial-reprogram-alt-20260807-20260729",
    expectedDecision: "deferred",
    nextDecision: "chosen",
    targetLabel: "Mercredi 2 septembre · Ayer’s Cliff sur une carte postale ancienne",
    action: "proposition différée reprogrammée et réactivée à sa nouvelle date",
    completionReason: "Bonne idée conservée et reprogrammée au mercredi 2 septembre; la tâche de déplacement est terminée et la proposition redevient active à sa nouvelle date."
  }
];

const initial = await Promise.all(operations.map(async (operation) => {
  const taskRef = db.doc(`tasks/${operation.taskId}`);
  const decisionRef = db.doc(`editorialDecisions/${operation.eventId}`);
  const archiveRef = db.doc(`changeArchive/${operation.archiveId}`);
  const [task, decision, archive] = await Promise.all([taskRef.get(), decisionRef.get(), archiveRef.get()]);
  if (!task.exists) throw new Error(`Tâche introuvable : ${operation.taskId}.`);
  if (!decision.exists) throw new Error(`Décision introuvable : ${operation.eventId}.`);
  const decisionValue = String(decision.data().decision || "undecided");
  const alreadyApplied = archive.exists
    || (task.data().status === "done" && decisionValue === operation.nextDecision);
  if (!alreadyApplied && decisionValue !== operation.expectedDecision) {
    throw new Error(`${operation.eventId} a changé (${decisionValue}); relire les interactions avant toute mutation.`);
  }
  return { ...operation, taskRef, decisionRef, archiveRef, task, decision, archive, alreadyApplied };
}));

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  actor: actorLabel,
  operations: initial.map((item) => ({
    eventId: item.eventId,
    taskStatusBefore: item.task.data().status,
    decisionBefore: item.decision.data().decision,
    decisionAfter: item.nextDecision,
    targetLabelAfter: item.targetLabel,
    alreadyApplied: item.alreadyApplied
  }))
}, null, 2));

if (apply) {
  for (const item of initial.filter((entry) => !entry.alreadyApplied)) {
    await db.runTransaction(async (transaction) => {
      const [task, decision, archive] = await Promise.all([
        transaction.get(item.taskRef),
        transaction.get(item.decisionRef),
        transaction.get(item.archiveRef)
      ]);
      if (archive.exists) return;
      if (!task.exists || !decision.exists
        || !item.task.updateTime.isEqual(task.updateTime)
        || !item.decision.updateTime.isEqual(decision.updateTime)) {
        throw new Error(`${item.eventId} a changé depuis le dry-run; aucune donnée n’a été écrasée.`);
      }
      const before = { task: task.data(), decision: decision.data() };
      const now = FieldValue.serverTimestamp();
      const taskAfter = {
        status: "done",
        targetLabel: item.targetLabel,
        completionReason: item.completionReason,
        completedAt: now,
        completedBy: actor.uid,
        completedByLabel: actorLabel,
        updatedAt: now,
        updatedBy: actor.uid
      };
      const decisionAfter = {
        decision: item.nextDecision,
        updatedAt: now,
        updatedBy: actor.uid,
        updatedByLabel: actorLabel
      };
      transaction.update(item.taskRef, taskAfter);
      if (String(decision.data().decision || "undecided") !== item.nextDecision) {
        transaction.update(item.decisionRef, decisionAfter);
      }
      transaction.set(item.archiveRef, {
        entityType: "editorialDecision",
        entityId: item.eventId,
        action: item.action,
        before,
        after: {
          task: { ...task.data(), ...taskAfter },
          decision: { ...decision.data(), ...decisionAfter }
        },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });
  }
  console.log("Réconciliation éditoriale appliquée avec archives avant/après.");
}

await deleteApp(app);
