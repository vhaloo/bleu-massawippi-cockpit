import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-media-comment-choices");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-media-comment-choices après vérification du dry-run.");

const operations = [
  {
    eventId: "s3d7",
    mediaId: "editorial-s3d7-five-gentle-real-photo-v2",
    commentId: "ekYwC6JvEba4UAPH83WF",
    taskId: "media-comment-ekYwC6JvEba4UAPH83WF",
    expectedCommunicationsIds: ["editorial-s3d7-five-gentle-real-photo-v1"],
    expectedWorkflowStages: ["media_review"],
    completionReason: "Une nouvelle photographie interne réelle et distincte a été proposée puis recommandée par les communications; la validation de la direction reste attendue."
  },
  {
    eventId: "alt-20260723",
    mediaId: "editorial-alt-20260723-living-shore-real-photo-v2",
    commentId: "xfOCfFFeFVcYnGcRwMrg",
    taskId: "media-comment-xfOCfFFeFVcYnGcRwMrg",
    expectedCommunicationsIds: [],
    expectedWorkflowStages: ["content_approved"],
    completionReason: "Une nouvelle photographie interne réelle et distincte a été proposée puis recommandée par les communications; la validation de la direction reste attendue."
  }
];

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Valentin Wittwe").slice(0, 120);

const ids = (side) => side?.status === "selected" && Array.isArray(side.mediaIds) ? side.mediaIds.map(String) : [];
const sameIds = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const emptySide = (role) => ({ status: "none", mediaIds: [], actorUid: "", actorLabel: "", actorRole: role, decidedAt: null });
const emptyOverride = () => ({ active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null });
const sameVersion = (before, after) => before.exists === after.exists && (!before.exists || before.updateTime.isEqual(after.updateTime));

function agreementFor(communications, direction, override) {
  const communicationsIds = ids(communications);
  const directionIds = ids(direction);
  const overrideIds = override?.active === true && Array.isArray(override.mediaIds) ? override.mediaIds.map(String) : [];
  if (overrideIds.length) return { status: "overridden", mediaIds: overrideIds, divergent: false };
  if (!communicationsIds.length || !directionIds.length) return { status: "pending", mediaIds: [], divergent: false };
  return sameIds(communicationsIds, directionIds)
    ? { status: "agreed", mediaIds: communicationsIds, divergent: false }
    : { status: "divergent", mediaIds: [], divergent: true };
}

function references(operation) {
  const mutationId = `editorial-cycle-20260812-media-${operation.commentId}`.slice(0, 160);
  return {
    media: db.doc(`mediaLinks/${operation.mediaId}`),
    decision: db.doc(`mediaDecisions/${operation.eventId}`),
    workflow: db.doc(`workflowStates/${operation.eventId}`),
    comment: db.doc(`comments/${operation.commentId}`),
    task: db.doc(`tasks/${operation.taskId}`),
    archive: db.doc(`changeArchive/${mutationId}`)
  };
}

async function readAll(refs, transaction = null) {
  const entries = Object.entries(refs);
  const rows = transaction
    ? await Promise.all(entries.map(([, reference]) => transaction.get(reference)))
    : await Promise.all(entries.map(([, reference]) => reference.get()));
  return Object.fromEntries(entries.map(([key], index) => [key, rows[index]]));
}

const initial = [];
for (const operation of operations) {
  const refs = references(operation);
  const snapshots = await readAll(refs);
  const alreadyApplied = snapshots.archive.exists
    && snapshots.comment.exists && snapshots.comment.data().resolved === true
    && snapshots.task.exists && snapshots.task.data().status === "done"
    && snapshots.decision.exists && sameIds(ids(snapshots.decision.data().communications), [operation.mediaId]);
  if (snapshots.archive.exists && !alreadyApplied) throw new Error(`${operation.eventId}: archive présente mais état final incohérent.`);
  if (!alreadyApplied) {
    if (!["media", "workflow", "comment", "task"].every((key) => snapshots[key].exists)) throw new Error(`${operation.eventId}: média, workflow, commentaire ou tâche introuvable.`);
    const media = snapshots.media.data();
    if (media.eventId !== operation.eventId || media.archived === true || media.publicationBlocked === true) throw new Error(`${operation.eventId}: le nouveau média n’est pas sélectionnable.`);
    if (!operation.expectedWorkflowStages.includes(String(snapshots.workflow.data().stage || ""))) throw new Error(`${operation.eventId}: le workflow a changé (${snapshots.workflow.data().stage || "absent"}).`);
    if (snapshots.comment.data().resolved === true || snapshots.task.data().status !== "pending") throw new Error(`${operation.eventId}: le commentaire ou sa tâche a déjà changé.`);
    const decision = snapshots.decision.exists ? snapshots.decision.data() : {};
    if (!sameIds(ids(decision.communications), operation.expectedCommunicationsIds)) throw new Error(`${operation.eventId}: le choix des communications a changé.`);
    if (ids(decision.direction).length) throw new Error(`${operation.eventId}: la direction a fait un choix depuis l’inventaire; relire avant d’agir.`);
    if (decision.override?.active === true) throw new Error(`${operation.eventId}: un override existe; aucune réconciliation automatique.`);
  }
  initial.push({ operation, refs, snapshots, alreadyApplied });
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  actor: actorLabel,
  operations: initial.map(({ operation, snapshots, alreadyApplied }) => ({
    eventId: operation.eventId,
    mediaId: operation.mediaId,
    workflow: snapshots.workflow.exists ? snapshots.workflow.data().stage : null,
    communicationsBefore: snapshots.decision.exists ? ids(snapshots.decision.data().communications) : [],
    communicationsAfter: [operation.mediaId],
    directionPreserved: snapshots.decision.exists ? ids(snapshots.decision.data().direction) : [],
    commentResolvedAfter: true,
    alreadyApplied
  })),
  maximumReads: 2 + operations.length * 6,
  maximumWrites: initial.filter((item) => !item.alreadyApplied).length * 4
}, null, 2));

if (APPLY) {
  for (const item of initial.filter((entry) => !entry.alreadyApplied)) {
    await db.runTransaction(async (transaction) => {
      const current = await readAll(item.refs, transaction);
      if (current.archive.exists) return;
      for (const key of ["media", "decision", "workflow", "comment", "task"]) {
        if (!sameVersion(item.snapshots[key], current[key])) throw new Error(`${item.operation.eventId}: état modifié depuis la lecture; aucune interaction écrasée.`);
      }
      const beforeDecision = current.decision.exists ? current.decision.data() : {};
      const direction = beforeDecision.direction || emptySide("director");
      const override = beforeDecision.override?.active === true ? beforeDecision.override : emptyOverride();
      if (ids(direction).length || override.active === true) throw new Error(`${item.operation.eventId}: une décision humaine nouvelle exige une relecture.`);
      const now = FieldValue.serverTimestamp();
      const communications = {
        status: "selected",
        mediaIds: [item.operation.mediaId],
        actorUid: actor.uid,
        actorLabel,
        actorRole: "admin",
        decidedAt: now
      };
      const agreement = agreementFor(communications, direction, override);
      const workflowStage = String(current.workflow.data().stage || "proposal");
      const decisionAfter = {
        eventId: item.operation.eventId,
        schemaVersion: 2,
        communications,
        direction,
        override,
        agreement,
        textGateStage: workflowStage,
        lastMutationId: `editorial-cycle-20260812-media-${item.operation.commentId}`.slice(0, 160),
        updatedAt: now,
        updatedBy: actor.uid,
        updatedByLabel: actorLabel
      };
      const commentBefore = current.comment.data();
      const taskBefore = current.task.data();
      const commentAfter = {
        resolved: true,
        resolvedAt: now,
        resolvedBy: actor.uid,
        resolvedByLabel: actorLabel,
        updatedAt: now,
        updatedBy: actor.uid
      };
      const taskAfter = {
        status: "done",
        completionReason: item.operation.completionReason,
        completedAt: now,
        completedBy: actor.uid,
        completedByLabel: actorLabel,
        updatedAt: now,
        updatedBy: actor.uid
      };
      transaction.set(item.refs.decision, decisionAfter);
      transaction.update(item.refs.comment, commentAfter);
      transaction.update(item.refs.task, taskAfter);
      transaction.set(item.refs.archive, {
        entityType: "mediaComment",
        entityId: item.operation.commentId,
        action: "nouveau média réel recommandé par les communications et commentaire classé",
        before: { decision: beforeDecision, comment: commentBefore, task: taskBefore, workflow: current.workflow.data() },
        after: { decision: decisionAfter, comment: { ...commentBefore, resolved: true, resolvedByLabel: actorLabel }, task: { ...taskBefore, status: "done", completionReason: item.operation.completionReason }, workflow: current.workflow.data() },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });
  }
  console.log("Choix média des communications et commentaires associés réconciliés avec archives avant/après.");
}

await deleteApp(app);
