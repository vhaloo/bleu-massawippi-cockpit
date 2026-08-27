import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-editorial-cycle-20260826");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-editorial-cycle-20260826 après vérification du dry-run.");

const DIRECTION_CHOICES = [
  {
    eventId: "alt-20260802",
    mediaId: "nature-alt-20260802-basin-voices-manuscript-v3",
    mediaTaskId: "media-choice-alt-20260802",
    workflowTaskId: "workflow-alt-20260802",
    expectedCommunicationsIds: []
  },
  {
    eventId: "alt-20260806",
    mediaId: "editorial-alt-20260806-shared-lake-real-v3",
    mediaTaskId: "media-choice-alt-20260806",
    expectedCommunicationsIds: []
  },
  {
    eventId: "nature-20260910-feuille-surface",
    mediaId: "editorial-nature-20260910-beaver-real-v2",
    mediaTaskId: "media-choice-nature-20260910-feuille-surface",
    workflowTaskId: "workflow-nature-20260910-feuille-surface",
    expectedCommunicationsIds: []
  },
  {
    eventId: "archives-20260912-vos-images",
    mediaId: "editorial-archives-20260912-pilsen-night-real-v2",
    mediaTaskId: "media-choice-archives-20260912-vos-images",
    expectedCommunicationsIds: ["editorial-archives-20260912-album-v1"]
  },
  {
    eventId: "quiz-20260913-trois-gestes",
    mediaId: "editorial-quiz-20260913-kayak-real-v2",
    mediaTaskId: "media-choice-quiz-20260913-trois-gestes",
    expectedCommunicationsIds: []
  },
  {
    eventId: "photo-20260915-soir-automne",
    mediaId: "editorial-photo-20260915-autumn-evening-v1",
    mediaTaskId: "media-choice-photo-20260915-soir-automne",
    workflowTaskId: "workflow-photo-20260915-soir-automne",
    expectedCommunicationsIds: []
  }
];

const COMMENT_RESOLUTIONS = [
  {
    eventId: "s4d6",
    mediaId: "editorial-s4d6-field-measure-real-v3",
    commentId: "2hlUPgONVL0v4s7NEwZm",
    taskId: "comment-2hlUPgONVL0v4s7NEwZm",
    note: "Une nouvelle photographie interne réelle montre un geste de mesure sur le terrain, sans plongée. Elle demeure bloquée jusqu’à la confirmation du crédit et du consentement."
  },
  {
    eventId: "alt-20260808",
    mediaId: "editorial-alt-20260808-coulisses-berge-real-v3",
    commentId: "6So2FxotRxyqe8Khqp4l",
    taskId: "media-comment-6So2FxotRxyqe8Khqp4l",
    note: "La photo de préparation jugée peu convaincante est remplacée par une vraie scène de tournage au bord du lac. Elle demeure bloquée jusqu’à la confirmation des crédits et consentements."
  }
];

const here = path.dirname(fileURLToPath(import.meta.url));
const editorialManifest = JSON.parse(fs.readFileSync(path.join(here, "editorial_media_manifest.json"), "utf8"));
const plannedMedia = new Map(editorialManifest.map((item) => [item.id, item]));
const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

const [admins, directors] = await Promise.all([
  db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get(),
  db.collection("users").where("role", "==", "director").where("active", "==", true).limit(2).get()
]);
if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
if (directors.size !== 1) throw new Error(`Une unique direction active est requise (trouvé : ${directors.size}).`);
const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
const director = { uid: directors.docs[0].id, ...directors.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Valentin Wittwe").slice(0, 120);

const selectedIds = (side) => side?.status === "selected" && Array.isArray(side.mediaIds) ? side.mediaIds.map(String) : [];
const sameIds = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const sameVersion = (before, current) => before.exists === current.exists && (!before.exists || before.updateTime?.isEqual?.(current.updateTime));
const emptyOverride = () => ({ active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null });
const readRefs = async (refs, transaction = null) => Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => {
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();
  return [key, snapshot];
})));
const completedTask = (before, reason, now) => ({
  ...before,
  status: "done",
  completionReason: reason,
  completedAt: now,
  completedBy: actor.uid,
  completedByLabel: actorLabel,
  updatedAt: now,
  updatedBy: actor.uid
});

async function acceptDirectionChoice(operation) {
  const mutationId = `editorial-cycle-20260826-direction-${operation.eventId}`.slice(0, 160);
  const refs = {
    media: db.doc(`mediaLinks/${operation.mediaId}`),
    decision: db.doc(`mediaDecisions/${operation.eventId}`),
    workflow: db.doc(`workflowStates/${operation.eventId}`),
    mediaTask: db.doc(`tasks/${operation.mediaTaskId}`),
    ...(operation.workflowTaskId ? { workflowTask: db.doc(`tasks/${operation.workflowTaskId}`) } : {}),
    archive: db.doc(`changeArchive/${mutationId}`)
  };
  const initial = await readRefs(refs);
  const finalState = initial.decision.exists
    && sameIds(selectedIds(initial.decision.data().communications), [operation.mediaId])
    && initial.decision.data().agreement?.status === "agreed"
    && initial.workflow.exists && initial.workflow.data().stage === "final_approved"
    && initial.mediaTask.exists && initial.mediaTask.data().status === "done"
    && (!operation.workflowTaskId || (initial.workflowTask.exists && initial.workflowTask.data().status === "done"));
  if (initial.archive.exists) {
    if (!finalState) throw new Error(`${operation.eventId}: l’archive existe, mais l’état final est incohérent.`);
    return { operation: "accept-direction", eventId: operation.eventId, mediaId: operation.mediaId, noOp: true };
  }
  if (!initial.media.exists || initial.media.data().eventId !== operation.eventId || initial.media.data().archived === true || initial.media.data().publicationBlocked === true) {
    throw new Error(`${operation.eventId}: le média retenu n’est plus sélectionnable.`);
  }
  if (!initial.decision.exists || !initial.workflow.exists || !initial.mediaTask.exists) throw new Error(`${operation.eventId}: état de validation incomplet.`);
  if (operation.workflowTaskId && !initial.workflowTask.exists) throw new Error(`${operation.eventId}: notification de texte approuvé introuvable.`);
  const before = Object.fromEntries(Object.entries(initial).filter(([key]) => key !== "archive").map(([key, snapshot]) => [key, snapshot.data()]));
  if (before.workflow.stage !== "content_approved") throw new Error(`${operation.eventId}: le texte n’est plus au stade approuvé (${before.workflow.stage || "absent"}).`);
  if (before.mediaTask.status !== "pending") throw new Error(`${operation.eventId}: la tâche média a changé.`);
  if (operation.workflowTaskId && before.workflowTask.status !== "pending") throw new Error(`${operation.eventId}: la notification de texte a changé.`);
  if (!sameIds(selectedIds(before.decision.direction), [operation.mediaId])) throw new Error(`${operation.eventId}: le choix de la direction a changé.`);
  if (!sameIds(selectedIds(before.decision.communications), operation.expectedCommunicationsIds)) throw new Error(`${operation.eventId}: le choix des communications a changé depuis l’inventaire.`);
  if (before.decision.override?.active === true) throw new Error(`${operation.eventId}: un remplacement explicite existe; aucune réconciliation automatique.`);

  const now = FieldValue.serverTimestamp();
  const communications = { status: "selected", mediaIds: [operation.mediaId], actorUid: actor.uid, actorLabel, actorRole: "admin", decidedAt: now };
  const decision = {
    ...before.decision,
    eventId: operation.eventId,
    schemaVersion: 2,
    communications,
    direction: before.decision.direction,
    override: emptyOverride(),
    agreement: { status: "agreed", mediaIds: [operation.mediaId], divergent: false },
    textGateStage: "final_approved",
    lastMutationId: mutationId,
    updatedAt: now,
    updatedBy: actor.uid,
    updatedByLabel: actorLabel
  };
  const workflow = { ...before.workflow, eventId: operation.eventId, stage: "final_approved", updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel };
  const taskReason = "Le choix explicite de la direction est accepté par les communications. Le texte et le visuel sont prêts; la publication n’est ni programmée ni marquée terminée.";
  const mediaTask = completedTask(before.mediaTask, taskReason, now);
  const workflowTask = operation.workflowTaskId ? completedTask(before.workflowTask, "Le texte approuvé par la direction est maintenant reflété dans le cycle final, sans programmation automatique.", now) : null;

  if (APPLY) await db.runTransaction(async (transaction) => {
    const current = await readRefs(refs, transaction);
    if (current.archive.exists) return;
    for (const key of Object.keys(refs).filter((key) => key !== "archive")) {
      if (!sameVersion(initial[key], current[key])) throw new Error(`${operation.eventId}: état modifié depuis le dry-run; relancer sans écraser la nouvelle interaction.`);
    }
    transaction.set(refs.decision, decision);
    transaction.set(refs.workflow, workflow);
    transaction.set(refs.mediaTask, mediaTask);
    if (workflowTask) transaction.set(refs.workflowTask, workflowTask);
    transaction.set(refs.archive, {
      entityType: "mediaDecision",
      entityId: operation.eventId,
      action: "choix explicite de la direction accepté par les communications",
      before,
      after: { decision, workflow, mediaTask, ...(workflowTask ? { workflowTask } : {}) },
      actorUid: actor.uid,
      actorLabel,
      createdAt: now
    });
  });
  return { operation: "accept-direction", eventId: operation.eventId, mediaId: operation.mediaId, workflowBefore: before.workflow.stage, workflowAfter: "final_approved", closesWorkflowNotice: Boolean(workflowTask), writes: workflowTask ? 5 : 4 };
}

async function resolveComment(operation) {
  const mutationId = `editorial-cycle-20260826-comment-${operation.commentId}`.slice(0, 160);
  const refs = {
    media: db.doc(`mediaLinks/${operation.mediaId}`),
    comment: db.doc(`comments/${operation.commentId}`),
    task: db.doc(`tasks/${operation.taskId}`),
    archive: db.doc(`changeArchive/${mutationId}`)
  };
  const initial = await readRefs(refs);
  const finalState = initial.comment.exists && initial.comment.data().resolved === true && initial.task.exists && initial.task.data().status === "done";
  if (initial.archive.exists) {
    if (!finalState) throw new Error(`${operation.commentId}: l’archive existe, mais le commentaire ou sa tâche reste actif.`);
    return { operation: "resolve-comment", commentId: operation.commentId, noOp: true };
  }
  const planned = plannedMedia.get(operation.mediaId);
  const plannedOnly = !initial.media.exists && !APPLY && planned?.eventId === operation.eventId && planned.archived !== true && planned.publicationBlocked === true;
  if (!initial.comment.exists || !initial.task.exists || (!initial.media.exists && !plannedOnly)) throw new Error(`${operation.commentId}: commentaire, tâche ou nouveau média manquant.`);
  if (initial.comment.data().resolved === true || initial.task.data().status !== "pending") throw new Error(`${operation.commentId}: le commentaire ou sa tâche a déjà changé.`);
  if (String(initial.comment.data().sectionId || "") !== operation.eventId) throw new Error(`${operation.commentId}: le commentaire ne cible plus le bon événement.`);
  const commentAuthorUid = String(initial.comment.data().authorUid || initial.comment.data().userUid || initial.comment.data().uid || "");
  const commentAuthorLabel = String(initial.comment.data().authorLabel || "");
  if (commentAuthorUid ? commentAuthorUid !== director.uid : commentAuthorLabel !== String(director.displayLabel || "Annie Goyer")) throw new Error(`${operation.commentId}: le commentaire ne provient plus de la direction active.`);
  if (initial.media.exists) {
    const media = initial.media.data();
    if (media.eventId !== operation.eventId || media.archived === true || media.stage === "archived") throw new Error(`${operation.commentId}: le nouveau média n’est pas une proposition active.`);
    if (media.publicationBlocked !== true) throw new Error(`${operation.commentId}: la garde de droits attendue manque sur le nouveau média.`);
  }

  const now = FieldValue.serverTimestamp();
  const before = { comment: initial.comment.data(), task: initial.task.data(), media: initial.media.exists ? initial.media.data() : planned };
  const comment = { ...before.comment, resolved: true, resolvedAt: now, resolvedBy: actor.uid, resolvedByLabel: actorLabel, updatedAt: now, updatedBy: actor.uid };
  const task = completedTask(before.task, operation.note, now);
  if (APPLY) await db.runTransaction(async (transaction) => {
    const current = await readRefs(refs, transaction);
    if (current.archive.exists) return;
    for (const key of ["media", "comment", "task"]) {
      if (!sameVersion(initial[key], current[key])) throw new Error(`${operation.commentId}: état modifié depuis le dry-run; relancer sans écraser la nouvelle interaction.`);
    }
    transaction.set(refs.comment, comment);
    transaction.set(refs.task, task);
    transaction.set(refs.archive, {
      entityType: "comment",
      entityId: operation.commentId,
      action: "commentaire de la direction traité par une nouvelle proposition réelle",
      before,
      after: { comment, task, media: current.media.data() },
      actorUid: actor.uid,
      actorLabel,
      createdAt: now
    });
  });
  return { operation: "resolve-comment", eventId: operation.eventId, commentId: operation.commentId, mediaId: operation.mediaId, mediaPlannedOnly: plannedOnly, publicationBlocked: true, writes: 3 };
}

try {
  const results = [];
  for (const operation of DIRECTION_CHOICES) results.push(await acceptDirectionChoice(operation));
  for (const operation of COMMENT_RESOLUTIONS) results.push(await resolveComment(operation));
  console.log(JSON.stringify({
    mode: APPLY ? "apply" : "dry-run",
    actor: actorLabel,
    direction: String(director.displayLabel || "Annie Goyer"),
    operations: results.length,
    estimatedWrites: results.reduce((sum, item) => sum + Number(item.writes || 0), 0),
    safeguards: { scheduledOrPublishedChanged: false, completionGateChanged: false, blockedMediaSelected: false },
    results
  }, null, 2));
} finally {
  await deleteApp(app);
}
