import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const commentId = argument("comment-id");
const eventId = argument("event-id");
const mediaId = argument("media-id");
const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm-comment-choice");
const validId = (value, maximum = 180) => value.length <= maximum && /^[A-Za-z0-9_-]{3,180}$/.test(value);

if (!validId(commentId, 160) || !validId(eventId, 80) || !validId(mediaId, 160)) throw new Error("Identifiants de commentaire, d’événement et de média requis.");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (apply && !confirm) throw new Error("Relancer avec --apply --confirm-comment-choice après vérification du dry-run.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const directors = await db.collection("users").where("role", "==", "director").where("active", "==", true).limit(2).get();
if (directors.size !== 1) throw new Error(`Une unique direction active est requise (trouvé : ${directors.size}).`);
const actor = { uid: directors.docs[0].id, ...directors.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction générale").slice(0, 120);
const mutationId = `media-comment-${commentId}-${mediaId}`.slice(0, 160);
const refs = {
  comment: db.doc(`comments/${commentId}`),
  media: db.doc(`mediaLinks/${mediaId}`),
  decision: db.doc(`mediaDecisions/${eventId}`),
  workflow: db.doc(`workflowStates/${eventId}`),
  archive: db.doc(`changeArchive/${mutationId}`)
};
const snapshots = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, reference]) => [key, await reference.get()])));
const sameVersion = (before, current) => before.exists === current.exists && (!before.exists || before.updateTime?.isEqual?.(current.updateTime));
const emptySide = (role) => ({ status: "none", mediaIds: [], actorUid: "", actorLabel: "", actorRole: role, decidedAt: null });
const emptyOverride = () => ({ active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null });
const selectedIds = (side) => side?.status === "selected" && Array.isArray(side.mediaIds) ? side.mediaIds : [];
const sameOrdered = (left, right) => left.length === right.length && left.every((item, index) => item === right[index]);
const approvedStages = new Set(["content_approved", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);

try {
  if (snapshots.archive.exists) {
    console.log(JSON.stringify({ noOp: true, mutationId, eventId, mediaId }, null, 2));
  } else {
    if (!snapshots.comment.exists) throw new Error("Commentaire source introuvable.");
    if (!snapshots.media.exists) throw new Error("Média introuvable; le créer avant de refléter le choix.");
    const comment = snapshots.comment.data();
    const media = snapshots.media.data();
    const commentActorUid = String(comment.authorUid || comment.userUid || comment.uid || "");
    const commentActorLabel = String(comment.authorLabel || "");
    if (String(comment.sectionId || "") !== eventId) throw new Error("Le commentaire ne cible pas cet événement.");
    if (commentActorUid ? commentActorUid !== actor.uid : commentActorLabel !== actorLabel) throw new Error("Le commentaire ne provient pas de la direction active.");
    if (media.eventId !== eventId || media.archived === true || media.publicationBlocked === true || media.stage === "archived") {
      throw new Error("Le média commenté n’est pas sélectionnable pour cet événement.");
    }
    const before = snapshots.decision.exists ? snapshots.decision.data() : {};
    const workflowBefore = snapshots.workflow.exists ? snapshots.workflow.data() : { eventId, stage: "proposal" };
    const workflowStage = String(workflowBefore.stage || "proposal");
    if (["scheduled", "published"].includes(workflowStage)) throw new Error("Une publication déjà programmée ou publiée doit être rouverte par les communications.");
    const communications = before.communications || emptySide("admin");
    const direction = { status: "selected", mediaIds: [mediaId], actorUid: actor.uid, actorLabel, actorRole: "director", decidedAt: FieldValue.serverTimestamp() };
    const textApproved = approvedStages.has(workflowStage);
    const communicationsIds = selectedIds(communications);
    const agreement = communicationsIds.length && textApproved
      ? (sameOrdered(communicationsIds, [mediaId])
        ? { status: "agreed", mediaIds: [mediaId], divergent: false }
        : { status: "divergent", mediaIds: [], divergent: true })
      : { status: "pending", mediaIds: [], divergent: false };
    const nextWorkflowStage = agreement.status === "agreed"
      ? "final_approved"
      : (workflowStage === "final_approved" ? "media_review" : workflowStage);
    const next = {
      eventId,
      schemaVersion: 2,
      communications,
      direction,
      override: emptyOverride(),
      agreement,
      textGateStage: workflowStage,
      lastMutationId: mutationId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByLabel: actorLabel
    };
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", mutationId, commentId, eventId, mediaId, actorLabel, communicationsChoice: selectedIds(communications), agreement: agreement.status, workflowBefore: workflowStage, workflowAfter: nextWorkflowStage }, null, 2));
    if (apply) {
      await db.runTransaction(async (transaction) => {
        const current = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, reference]) => [key, await transaction.get(reference)])));
        if (current.archive.exists) return;
        if (!Object.keys(refs).filter((key) => key !== "archive").every((key) => sameVersion(snapshots[key], current[key]))) {
          throw new Error("État modifié depuis le dry-run; relancer sans écraser le changement récent.");
        }
        transaction.set(refs.decision, next);
        if (!snapshots.workflow.exists || nextWorkflowStage !== workflowStage) {
          transaction.set(refs.workflow, { eventId, stage: nextWorkflowStage, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid, updatedByLabel: actorLabel });
        }
        transaction.set(refs.archive, {
          entityType: "mediaDecision",
          entityId: eventId,
          action: "choix média explicite de la direction reflété depuis son commentaire",
          sourceCommentId: commentId,
          before: { decision: before, workflow: workflowBefore },
          after: { decision: next, workflow: { eventId, stage: nextWorkflowStage } },
          actorUid: actor.uid,
          actorLabel,
          createdAt: FieldValue.serverTimestamp()
        });
      });
      console.log("Choix média de la direction appliqué de façon atomique et auditable.");
    }
  }
} finally {
  await deleteApp(app);
}
