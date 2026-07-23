import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const feedbackId = argument("feedback-id");
const taskId = argument("task-id") || `feedback-${feedbackId}`;
const targetType = argument("target-type") || "schedule";
const targetId = argument("target-id");
const requestedLabel = argument("target-label");
const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm-integrated");

if (!/^[A-Za-z0-9_-]{3,160}$/.test(feedbackId)) throw new Error("Identifiant de rétroaction requis.");
if (!/^[A-Za-z0-9_-]{3,180}$/.test(taskId)) throw new Error("Identifiant de tâche invalide.");
if (!/^[A-Za-z0-9_-]{3,180}$/.test(targetId)) throw new Error("Identifiant de destination requis.");
if (!['schedule'].includes(targetType)) throw new Error("Cette commande ciblée accepte seulement une publication du calendrier.");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (apply && !confirm) throw new Error("Relancer avec --apply --confirm-integrated après vérification du dry-run.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const users = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (users.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${users.size}).`);
const actor = { uid: users.docs[0].id, ...users.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);
const archiveId = `process-feedback-${feedbackId}`;
const refs = {
  feedback: db.doc(`cockpitFeedback/${feedbackId}`),
  task: db.doc(`tasks/${taskId}`),
  target: db.doc(`scheduleItems/${targetId}`),
  archive: db.doc(`changeArchive/${archiveId}`)
};
const [feedback, task, target, archive] = await Promise.all(Object.values(refs).map((reference) => reference.get()));
if (!feedback.exists) throw new Error("Rétroaction introuvable.");
if (!task.exists) throw new Error("Tâche associée introuvable.");
if (!target.exists) throw new Error("La publication de destination n'existe pas; la rétroaction reste ouverte.");
const targetLabel = String(requestedLabel || target.data().title || targetId).trim().slice(0, 220);
const alreadyIntegrated = archive.exists
  || (feedback.data().status === "done" && task.data().status === "done" && task.data().targetType === targetType && task.data().targetId === targetId);

if (alreadyIntegrated) {
  console.log(JSON.stringify({ noOp: true, feedbackId, taskId, targetType, targetId, archiveId }, null, 2));
  await deleteApp(app);
} else {
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    feedbackId,
    taskId,
    previousTarget: `${task.data().targetType || ""}/${task.data().targetId || ""}`,
    nextTarget: `${targetType}/${targetId}`,
    targetLabel,
    feedbackPreview: String(feedback.data().message || "").slice(0, 280)
  }, null, 2));
  if (apply) {
    await db.runTransaction(async (transaction) => {
      const [currentFeedback, currentTask, currentTarget, currentArchive] = await Promise.all(Object.values(refs).map((reference) => transaction.get(reference)));
      if (currentArchive.exists) return;
      if (!currentFeedback.exists || !currentTask.exists || !currentTarget.exists) throw new Error("Un document ciblé a disparu; aucune écriture appliquée.");
      if (!feedback.updateTime.isEqual(currentFeedback.updateTime) || !task.updateTime.isEqual(currentTask.updateTime) || !target.updateTime.isEqual(currentTarget.updateTime)) {
        throw new Error("État modifié depuis le dry-run; relancer sans écraser le changement récent.");
      }
      const now = FieldValue.serverTimestamp();
      const taskAfter = {
        status: "done",
        title: `Publication préparée — ${targetLabel}`,
        targetType,
        targetId,
        targetLabel,
        message: `${String(currentFeedback.data().message || "").trim()}\n\nIntégrée dans la publication du ${currentTarget.data().dateKey || currentTarget.data().dateIso || "créneau prévu"}.`,
        updatedAt: now,
        updatedBy: actor.uid
      };
      const feedbackAfter = {
        status: "done",
        linkedTargetType: targetType,
        linkedTargetId: targetId,
        linkedTargetLabel: targetLabel,
        resolvedAt: now,
        resolvedBy: actor.uid,
        resolvedByLabel: actorLabel,
        updatedAt: now,
        updatedBy: actor.uid
      };
      transaction.update(refs.feedback, feedbackAfter);
      transaction.update(refs.task, taskAfter);
      transaction.set(refs.archive, {
        entityType: "cockpitFeedback",
        entityId: feedbackId,
        action: "rétroaction intégrée dans une publication planifiée",
        before: { feedback: currentFeedback.data(), task: currentTask.data() },
        after: { feedback: feedbackAfter, task: taskAfter, publication: { id: targetId, title: targetLabel, dateIso: currentTarget.data().dateIso || "" } },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });
    console.log("Rétroaction reliée à la publication et classée atomiquement.");
  }
  await deleteApp(app);
}
