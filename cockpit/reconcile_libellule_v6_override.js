import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const EVENT_ID = "alt-20260715";
const MEDIA_ID = "nature-alt-20260715-libellule-field-plate-v6";
const ACTION_ID = `media-direction-approval-${EVENT_ID}`;
const MUTATION_ID = "libellule-v6-communications-override-20260714";
const ACTION_REPAIR_ID = `${MUTATION_ID}-action-repair`;
const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-user-request");
const REASON = "Visuel retenu par les communications et transmis à la direction hors cockpit; override demandé par Valentin pour programmer la publication.";

const emptySide = (role) => ({ status: "none", mediaIds: [], actorUid: "", actorLabel: "", actorRole: role, decidedAt: null });
const sameVersion = (before, current) => before.exists === current.exists && (!before.exists || before.updateTime?.isEqual?.(current.updateTime));

function actionQueueKey(value, id) {
  const token = value.state === "pending" ? "p" : "d";
  return `aq1|${value.assigneeUid.length}|${value.assigneeUid}|${value.assigneeRole}|${token}|${String(value.priorityKey).padStart(4, "0")}|${value.eventDateIso}|${id}`;
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
  if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-user-request après vérification du dry-run.");
  const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
  const db = getFirestore(app);
  const adminUsers = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
  if (adminUsers.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${adminUsers.size}).`);
  const actor = { uid: adminUsers.docs[0].id, ...adminUsers.docs[0].data() };
  const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);
  const refs = {
    media: db.doc(`mediaLinks/${MEDIA_ID}`), decision: db.doc(`mediaDecisions/${EVENT_ID}`),
    workflow: db.doc(`workflowStates/${EVENT_ID}`), action: db.doc(`actionItems/${ACTION_ID}`),
    archive: db.doc(`changeArchive/${MUTATION_ID}`)
  };
  const [mediaSnap, decisionSnap, workflowSnap, actionSnap, archiveSnap] = await Promise.all(Object.values(refs).map((ref) => ref.get()));
  if (archiveSnap.exists) {
    const repairReference = db.doc(`changeArchive/${ACTION_REPAIR_ID}`);
    const repairSnapshot = await repairReference.get();
    const actionBefore = actionSnap.exists ? actionSnap.data() : null;
    const needsRepair = Boolean(actionBefore && (actionBefore.mediaId !== MEDIA_ID || /v5/i.test(`${actionBefore.title || ""} ${actionBefore.message || ""}`)));
    console.log(JSON.stringify({ noOp: !needsRepair || repairSnapshot.exists, mutationId: MUTATION_ID, staleActionRepair: needsRepair && !repairSnapshot.exists, mode: APPLY ? "apply" : "dry-run" }, null, 2));
    if (needsRepair && !repairSnapshot.exists && APPLY) {
      await db.runTransaction(async (transaction) => {
        const [currentAction, currentRepair] = await Promise.all([transaction.get(refs.action), transaction.get(repairReference)]);
        if (currentRepair.exists) return;
        if (!sameVersion(actionSnap, currentAction)) throw new Error("La tâche a changé; relancer le dry-run.");
        const next = { ...currentAction.data(), mediaId: MEDIA_ID, title: "Visuel de la libellule validé par les communications", message: REASON, state: "done", updatedAt: Timestamp.now(), updatedBy: actor.uid, lastMutationId: ACTION_REPAIR_ID };
        next.queueKey = actionQueueKey(next, ACTION_ID);
        transaction.set(refs.action, next);
        transaction.set(repairReference, { entityType: "actionItem", entityId: ACTION_ID, action: "référence v5 remplacée par le visuel v6 final", before: actionBefore, after: next, actorUid: actor.uid, actorLabel, createdAt: Timestamp.now() });
      });
      console.log("Référence de tâche v5 remplacée par le visuel v6 final.");
    }
    await deleteApp(app); return;
  }
  const media = mediaSnap.data();
  if (!mediaSnap.exists || media.eventId !== EVENT_ID || media.archived === true || media.publicationBlocked === true) throw new Error("La proposition v6 n’est pas sélectionnable.");
  const beforeDecision = decisionSnap.exists ? decisionSnap.data() : {};
  const recommended = beforeDecision.communications?.status === "selected" && beforeDecision.communications.mediaIds?.includes(MEDIA_ID);
  if (!recommended) throw new Error("Le visuel v6 n’est plus la recommandation actuelle des communications; aucune écriture automatique.");
  const now = Timestamp.now();
  const workflowBefore = workflowSnap.exists ? workflowSnap.data() : { eventId: EVENT_ID, stage: "proposal" };
  const workflowStage = String(workflowBefore.stage || "proposal");
  const textGateStage = ["proposal", "content_review", "changes_requested", "content_changes_requested"].includes(workflowStage) ? "content_approved" : workflowStage;
  const workflowAfter = { eventId: EVENT_ID, stage: ["scheduled", "published"].includes(workflowStage) ? workflowStage : "final_approved", updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel };
  const communications = { status: "selected", mediaIds: [MEDIA_ID], actorUid: actor.uid, actorLabel, actorRole: "admin", decidedAt: beforeDecision.communications?.decidedAt || now };
  const direction = beforeDecision.direction || emptySide("director");
  const decisionAfter = {
    eventId: EVENT_ID, schemaVersion: 2, communications, direction,
    override: { active: true, mediaIds: [MEDIA_ID], reason: REASON, actorUid: actor.uid, actorLabel, actorRole: "admin", decidedAt: now },
    agreement: { status: "overridden", mediaIds: [MEDIA_ID], divergent: false },
    textGateStage, lastMutationId: MUTATION_ID, updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel
  };
  const actionAfter = actionSnap.exists ? { ...actionSnap.data(), mediaId: MEDIA_ID, title: "Visuel de la libellule validé par les communications", message: REASON, state: "done", updatedAt: now, updatedBy: actor.uid, lastMutationId: MUTATION_ID } : null;
  if (actionAfter) actionAfter.queueKey = actionQueueKey(actionAfter, ACTION_ID);
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", eventId: EVENT_ID, mediaId: MEDIA_ID, recommended, workflowBefore: workflowStage, workflowAfter: workflowAfter.stage, directionChoicePreserved: direction.status === "selected", actionClosed: Boolean(actionAfter), reason: REASON }, null, 2));
  if (!APPLY) { await deleteApp(app); return; }
  await db.runTransaction(async (transaction) => {
    const [mediaCurrent, decisionCurrent, workflowCurrent, actionCurrent, archiveCurrent] = await Promise.all(Object.values(refs).map((ref) => transaction.get(ref)));
    if (archiveCurrent.exists) return;
    if (![sameVersion(mediaSnap, mediaCurrent), sameVersion(decisionSnap, decisionCurrent), sameVersion(workflowSnap, workflowCurrent), sameVersion(actionSnap, actionCurrent)].every(Boolean)) throw new Error("État modifié depuis le dry-run; relancer sans écraser le nouveau choix.");
    transaction.set(refs.decision, decisionAfter);
    transaction.set(refs.workflow, workflowAfter);
    if (actionAfter) transaction.set(refs.action, actionAfter);
    transaction.set(refs.archive, { entityType: "mediaDecision", entityId: EVENT_ID, action: "override média demandé par les communications", before: { decision: beforeDecision, workflow: workflowBefore, action: actionSnap.exists ? actionSnap.data() : {} }, after: { decision: decisionAfter, workflow: workflowAfter, action: actionAfter || {} }, actorUid: actor.uid, actorLabel, createdAt: now });
  });
  console.log("Override v6 appliqué de façon atomique, sans attribuer de choix à la direction.");
  await deleteApp(app);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
