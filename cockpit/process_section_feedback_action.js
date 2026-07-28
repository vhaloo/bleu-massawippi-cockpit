import process from "node:process";
import { readFileSync } from "node:fs";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const feedbackId = argument("feedback-id");
const taskId = argument("task-id") || `feedback-${feedbackId}`;
const sectionId = argument("section-id");
const requestedLabel = argument("section-label");
const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm-integrated");

if (!/^[A-Za-z0-9_-]{3,160}$/.test(feedbackId)) throw new Error("Identifiant de rétroaction requis.");
if (!/^[A-Za-z0-9_-]{3,180}$/.test(taskId)) throw new Error("Identifiant de tâche invalide.");
if (!/^[A-Za-z0-9_-]{3,180}$/.test(sectionId)) throw new Error("Identifiant de section requis.");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (apply && !confirm) throw new Error("Relancer avec --apply --confirm-integrated après vérification du dry-run.");

const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");
if (!source.includes(`id="${sectionId}"`) && !source.includes(`id='${sectionId}'`)) {
  throw new Error("La section intégrée n'existe pas dans la source locale; la rétroaction reste ouverte.");
}

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const users = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (users.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${users.size}).`);
const actor = { uid: users.docs[0].id, ...users.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);
const archiveId = `process-section-feedback-${feedbackId}`;
const refs = {
  feedback: db.doc(`cockpitFeedback/${feedbackId}`),
  task: db.doc(`tasks/${taskId}`),
  archive: db.doc(`changeArchive/${archiveId}`)
};
const [feedback, task, archive] = await Promise.all(Object.values(refs).map((reference) => reference.get()));
if (!feedback.exists) throw new Error("Rétroaction introuvable.");
const sectionLabel = String(requestedLabel || sectionId).trim().slice(0, 220);
const alreadyIntegrated = archive.exists
  || (feedback.data().status === "done"
    && feedback.data().linkedTargetType === "section"
    && feedback.data().linkedTargetId === sectionId
    && (!task.exists || task.data().status === "done"));

if (alreadyIntegrated) {
  console.log(JSON.stringify({ noOp: true, feedbackId, taskId, sectionId, archiveId }, null, 2));
  await deleteApp(app);
} else {
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    feedbackId,
    taskId: task.exists ? taskId : null,
    previousTarget: task.exists ? `${task.data().targetType || ""}/${task.data().targetId || ""}` : null,
    nextTarget: `section/${sectionId}`,
    sectionLabel,
    feedbackPreview: String(feedback.data().message || "").slice(0, 280)
  }, null, 2));
  if (apply) {
    await db.runTransaction(async (transaction) => {
      const [currentFeedback, currentTask, currentArchive] = await Promise.all(Object.values(refs).map((reference) => transaction.get(reference)));
      if (currentArchive.exists) return;
      if (!currentFeedback.exists) throw new Error("La rétroaction a disparu; aucune écriture appliquée.");
      if (!feedback.updateTime.isEqual(currentFeedback.updateTime)
        || task.exists !== currentTask.exists
        || (task.exists && !task.updateTime.isEqual(currentTask.updateTime))) {
        throw new Error("État modifié depuis le dry-run; relancer sans écraser le changement récent.");
      }
      const now = FieldValue.serverTimestamp();
      const feedbackAfter = {
        status: "done",
        linkedTargetType: "section",
        linkedTargetId: sectionId,
        linkedTargetLabel: sectionLabel,
        resolvedAt: now,
        resolvedBy: actor.uid,
        resolvedByLabel: actorLabel,
        updatedAt: now,
        updatedBy: actor.uid
      };
      const taskAfter = currentTask.exists ? {
        status: "done",
        targetType: "section",
        targetId: sectionId,
        targetLabel: sectionLabel,
        message: `${String(currentFeedback.data().message || "").trim()}\n\nIntégrée dans la section « ${sectionLabel} » du cockpit.`,
        updatedAt: now,
        updatedBy: actor.uid
      } : null;
      transaction.update(refs.feedback, feedbackAfter);
      if (taskAfter) transaction.update(refs.task, taskAfter);
      transaction.set(refs.archive, {
        entityType: "cockpitFeedback",
        entityId: feedbackId,
        action: "rétroaction intégrée dans une section du cockpit",
        before: { feedback: currentFeedback.data(), task: currentTask.exists ? currentTask.data() : null },
        after: { feedback: feedbackAfter, task: taskAfter, section: { id: sectionId, label: sectionLabel } },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });
    console.log("Rétroaction reliée à la section et classée atomiquement.");
  }
  await deleteApp(app);
}
