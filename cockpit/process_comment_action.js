import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const commentId = argument("comment-id");
const taskId = argument("task-id");
const apply = process.argv.includes("--apply");
if (!/^[A-Za-z0-9_-]{3,160}$/.test(commentId) || !/^[A-Za-z0-9_-]{3,180}$/.test(taskId)) throw new Error("Identifiants de commentaire et de tâche requis.");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const users = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (users.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${users.size}).`);
const actor = { uid: users.docs[0].id, ...users.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);
const refs = { comment: db.doc(`comments/${commentId}`), task: db.doc(`tasks/${taskId}`), archive: db.doc(`changeArchive/process-comment-${commentId}`) };
const [comment, task, archive] = await Promise.all([refs.comment.get(), refs.task.get(), refs.archive.get()]);
if (!comment.exists) throw new Error("Commentaire introuvable.");
if (!task.exists) throw new Error("Tâche associée introuvable.");
if (archive.exists || (comment.data().resolved === true && task.data().status === "done")) {
  console.log(JSON.stringify({ noOp: true, commentId, taskId }, null, 2));
  await deleteApp(app);
} else {
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", commentId, taskId, sectionId: comment.data().sectionId || "", taskTarget: task.data().targetId || "", commentPreview: String(comment.data().comment || "").slice(0, 240) }, null, 2));
  if (apply) {
    await db.runTransaction(async (transaction) => {
      const [currentComment, currentTask, currentArchive] = await Promise.all([transaction.get(refs.comment), transaction.get(refs.task), transaction.get(refs.archive)]);
      if (currentArchive.exists) return;
      if (!currentComment.exists || !currentTask.exists || !comment.updateTime.isEqual(currentComment.updateTime) || !task.updateTime.isEqual(currentTask.updateTime)) throw new Error("État modifié depuis le dry-run; relancer sans écraser le changement récent.");
      const now = FieldValue.serverTimestamp();
      transaction.update(refs.comment, { resolved: true, resolvedAt: now, resolvedBy: actor.uid, resolvedByLabel: actorLabel, updatedAt: now, updatedBy: actor.uid });
      transaction.update(refs.task, { status: "done", updatedAt: now, updatedBy: actor.uid });
      transaction.set(refs.archive, { entityType: "comment", entityId: commentId, action: "commentaire traité après intégration du contenu", before: { comment: currentComment.data(), task: currentTask.data() }, after: { comment: { resolved: true, resolvedByLabel: actorLabel }, task: { status: "done" } }, actorUid: actor.uid, actorLabel, createdAt: now });
    });
    console.log("Commentaire et tâche classés atomiquement après intégration.");
  }
  await deleteApp(app);
}
