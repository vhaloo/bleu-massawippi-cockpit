import process from "node:process";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const EVENT_ID = "alt-20260715";
const MEDIA_ID = "nature-alt-20260715-libellule-manuscript-v5-scientific-bilingual";
const ACTION_ID = `media-direction-approval-${EVENT_ID}`;
const MUTATION_ID = "m0-libellule-v5-queuekey-reconcile-20260714";
const APPLY = process.argv.includes("--apply");
const CONFIRM_KNOWN_INTENT = process.argv.includes("--confirm-known-intent");
const KNOWN_INTENT_SOURCE = "PLAN_MAITRE_OPTIMISATION_COCKPIT_2026-07-14.md — sections 1B et 18A (instruction explicite de Valentin)";
const APPROVED_TEXT_STAGES = new Set(["content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);

function emptySide(role) {
  return { status: "none", mediaIds: [], actorUid: "", actorLabel: "", actorRole: role, decidedAt: null };
}

function emptyOverride() {
  return { active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null };
}

function actionItemQueueKey(value, actionItemId) {
  const priority = Number(value.priorityKey);
  if (!Number.isInteger(priority) || priority < 0 || priority > 9999) throw new Error("Priorité de décision invalide.");
  const stateToken = value.state === "pending" ? "p" : value.state === "done" ? "d" : "";
  if (!stateToken) throw new Error("État de décision invalide.");
  return `aq1|${value.assigneeUid.length}|${value.assigneeUid}|${value.assigneeRole}|${stateToken}|${String(priority).padStart(4, "0")}|${value.eventDateIso}|${actionItemId}`;
}

function agreementFor(communications, direction, override, textApproved) {
  const directionIds = direction?.status === "selected" ? direction.mediaIds || [] : [];
  if (textApproved
    && override?.active
    && override.mediaIds?.length
    && String(override.reason || "").trim()
    && directionIds.length === override.mediaIds.length
    && directionIds.every((id, index) => id === override.mediaIds[index])) {
    return { status: "overridden", mediaIds: [...override.mediaIds], divergent: false };
  }
  const left = communications?.status === "selected" ? communications.mediaIds || [] : [];
  const right = directionIds;
  if (left.length && right.length) {
    if (textApproved && left.length === right.length && left.every((id, index) => id === right[index])) {
      return { status: "agreed", mediaIds: [...left], divergent: false };
    }
    if (left.join("\u0000") !== right.join("\u0000")) return { status: "divergent", mediaIds: [], divergent: true };
  }
  return { status: "pending", mediaIds: [], divergent: false };
}

function reconciledWorkflowStage(currentStage, agreement) {
  const approved = ["agreed", "overridden"].includes(agreement.status);
  if (approved && !["final_approved", "scheduled", "published"].includes(currentStage)) return "final_approved";
  if (!approved && currentStage === "final_approved") return "media_review";
  if (!approved && ["scheduled", "published"].includes(currentStage)) {
    throw new Error("La publication est déjà programmée ou publiée sans accord média structuré; une correction humaine est requise avant la réconciliation M0.");
  }
  return currentStage;
}

function sameSnapshotVersion(expected, current) {
  if (expected.exists !== current.exists) return false;
  if (!expected.exists) return true;
  return Boolean(expected.updateTime?.isEqual?.(current.updateTime));
}

async function uniqueActiveUser(db, role) {
  const snapshot = await db.collection("users").where("role", "==", role).where("active", "==", true).limit(2).get();
  if (snapshot.size !== 1) throw new Error(`Le rôle ${role} doit correspondre à un unique compte actif (trouvé : ${snapshot.size}).`);
  return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers la clé locale du compte de service.");
  const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
  const db = getFirestore(app);
  const [director, communications] = await Promise.all([uniqueActiveUser(db, "director"), uniqueActiveUser(db, "admin")]);
  const refs = {
    media: db.doc(`mediaLinks/${MEDIA_ID}`),
    decision: db.doc(`mediaDecisions/${EVENT_ID}`),
    workflow: db.doc(`workflowStates/${EVENT_ID}`),
    action: db.doc(`actionItems/${ACTION_ID}`),
    archive: db.doc(`changeArchive/${MUTATION_ID}`)
  };
  const [mediaSnap, decisionSnap, workflowSnap, actionSnap, archiveSnap] = await Promise.all([
    refs.media.get(), refs.decision.get(), refs.workflow.get(), refs.action.get(), refs.archive.get()
  ]);
  if (archiveSnap.exists) {
    console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", noOp: true, reason: "archive idempotente déjà présente", mutationId: MUTATION_ID }, null, 2));
    return;
  }
  if (!mediaSnap.exists || mediaSnap.data().eventId !== EVENT_ID || mediaSnap.data().archived === true || mediaSnap.data().publicationBlocked === true) {
    throw new Error("Le visuel v5 bilingue n’est pas une proposition sélectionnable de cet événement.");
  }
  const beforeDecision = decisionSnap.exists ? decisionSnap.data() : {};
  const recommendationEvidence = mediaSnap.data().selectedFinal === true
    || (beforeDecision.communications?.status === "selected" && beforeDecision.communications.mediaIds?.includes(MEDIA_ID));
  if (APPLY && !recommendationEvidence && !CONFIRM_KNOWN_INTENT) {
    throw new Error(`La trace Firestore n’est pas présente. Relancer avec --apply --confirm-known-intent uniquement après vérification de la source locale : ${KNOWN_INTENT_SOURCE}`);
  }
  const recommendationAuthorized = recommendationEvidence || CONFIRM_KNOWN_INTENT;

  const workflowStage = workflowSnap.exists ? String(workflowSnap.data().stage || "proposal") : "proposal";
  const textApproved = APPROVED_TEXT_STAGES.has(workflowStage);
  const now = Timestamp.now();
  const communicationsSide = {
    status: "selected",
    mediaIds: [MEDIA_ID],
    actorUid: communications.uid,
    actorLabel: String(communications.displayLabel || "Direction des communications").slice(0, 120),
    actorRole: "admin",
    decidedAt: beforeDecision.communications?.decidedAt || now
  };
  const directionSide = beforeDecision.direction || emptySide("director");
  const override = beforeDecision.override || emptyOverride();
  const agreement = agreementFor(communicationsSide, directionSide, override, textApproved);
  if (override.active === true && agreement.status !== "overridden") {
    throw new Error("L’override existant ne correspond pas au choix structuré de la direction; aucune écriture automatique n’est permise.");
  }
  const nextWorkflowStage = reconciledWorkflowStage(workflowStage, agreement);
  const workflowAfter = {
    eventId: EVENT_ID,
    stage: nextWorkflowStage,
    updatedAt: now,
    updatedBy: communications.uid,
    updatedByLabel: communicationsSide.actorLabel
  };
  const workflowNeedsWrite = !workflowSnap.exists || nextWorkflowStage !== workflowStage;
  const action = {
    assigneeUid: director.uid,
    assigneeRole: "director",
    state: ["agreed", "overridden"].includes(agreement.status) ? "done" : "pending",
    sourceType: "schedule",
    sourceId: EVENT_ID,
    mediaId: MEDIA_ID,
    eventDateIso: "2026-07-15",
    actionType: textApproved ? "media_direction_approval" : "approve_text_then_media",
    title: textApproved ? "Vérifier et approuver le visuel scientifique de la libellule" : "Valider le texte, puis le visuel recommandé de la libellule",
    message: textApproved
      ? "Les communications recommandent le visuel bilingue v5 à quatre ailes. Vérifier le visuel, puis le choisir ou demander une correction."
      : "Les communications recommandent le visuel bilingue v5 à quatre ailes. La première porte demeure l’approbation du texte; le choix du visuel vient ensuite.",
    priorityKey: 10,
    createdByUid: communications.uid,
    createdAt: actionSnap.exists ? actionSnap.data().createdAt : now,
    updatedAt: now,
    updatedBy: communications.uid,
    lastMutationId: MUTATION_ID,
    schemaVersion: 1
  };
  action.queueKey = actionItemQueueKey(action, ACTION_ID);
  const decision = {
    eventId: EVENT_ID,
    schemaVersion: 2,
    communications: communicationsSide,
    direction: directionSide,
    override,
    agreement,
    textGateStage: workflowStage,
    lastMutationId: MUTATION_ID,
    updatedAt: now,
    updatedBy: communications.uid,
    updatedByLabel: communicationsSide.actorLabel
  };

  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", eventId: EVENT_ID, mediaId: MEDIA_ID, workflowStage, nextWorkflowStage, textApproved, recommendationEvidence, recommendationAuthorized, knownIntentConfirmed: CONFIRM_KNOWN_INTENT, knownIntentSource: KNOWN_INTENT_SOURCE, actionId: ACTION_ID, actionState: action.state, agreement: agreement.status }, null, 2));
  if (!APPLY) return;
  await db.runTransaction(async (transaction) => {
    const [currentMedia, currentDecision, currentWorkflow, currentAction, currentArchive] = await Promise.all([
      transaction.get(refs.media),
      transaction.get(refs.decision),
      transaction.get(refs.workflow),
      transaction.get(refs.action),
      transaction.get(refs.archive)
    ]);
    if (currentArchive.exists) return;
    if (![sameSnapshotVersion(mediaSnap, currentMedia), sameSnapshotVersion(decisionSnap, currentDecision), sameSnapshotVersion(workflowSnap, currentWorkflow), sameSnapshotVersion(actionSnap, currentAction)].every(Boolean)) {
      throw new Error("État modifié depuis la lecture ciblée; relancer le dry-run au lieu d’écraser une interaction récente.");
    }
    transaction.set(refs.decision, decision);
    transaction.set(refs.action, action);
    if (workflowNeedsWrite) transaction.set(refs.workflow, workflowAfter);
    transaction.set(refs.archive, {
      entityType: "m0Reconciliation",
      entityId: EVENT_ID,
      action: "recommandation communications v5 et décision personnelle direction",
      before: { mediaDecision: currentDecision.exists ? currentDecision.data() : {}, actionItem: currentAction.exists ? currentAction.data() : {}, workflow: currentWorkflow.exists ? currentWorkflow.data() : {} },
      after: { mediaDecision: decision, actionItem: action, workflow: workflowNeedsWrite ? workflowAfter : currentWorkflow.data() },
      actorUid: communications.uid,
      actorLabel: communicationsSide.actorLabel,
      createdAt: FieldValue.serverTimestamp()
    });
  });
  console.log("Réconciliation M0 appliquée de manière idempotente.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
