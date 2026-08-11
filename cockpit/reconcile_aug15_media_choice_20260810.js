import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm-aug15-communications-choice");
if (apply && !confirmed) throw new Error("Relancer avec --apply --confirm-aug15-communications-choice après vérification du dry-run.");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");

const eventId = "s4d1b";
const mediaId = "editorial-s4d1b-field-internal-photo-v3";
const mutationId = "aug15-communications-choice-rights-20260810-v2";
const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const refs = {
  media: db.doc(`mediaLinks/${mediaId}`),
  decision: db.doc(`mediaDecisions/${eventId}`),
  workflow: db.doc(`workflowStates/${eventId}`),
  archive: db.doc(`changeArchive/${mutationId}`)
};

const emptySide = (role) => ({ status: "none", mediaIds: [], actorUid: "", actorLabel: "", actorRole: role, decidedAt: null });
const emptyOverride = () => ({ active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null });
const selectedIds = (side) => side?.status === "selected" && Array.isArray(side.mediaIds) ? side.mediaIds : [];
const sameIds = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const approvedStages = new Set(["content_approved", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);

try {
  const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
  if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
  const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
  const actorLabel = String(actor.displayLabel || "Valentin Wittwe").slice(0, 120);
  const snapshots = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, reference]) => [key, await reference.get()])));
  if (!snapshots.media.exists || snapshots.media.data().eventId !== eventId) throw new Error("Le média du 15 août est introuvable ou mal rattaché.");
  if (!snapshots.workflow.exists || !approvedStages.has(String(snapshots.workflow.data().stage || ""))) {
    throw new Error("Le texte du 15 août n’est pas encore dans une étape approuvée; ne pas créer un faux feu vert visuel.");
  }

  const beforeMedia = snapshots.media.data();
  const beforeDecision = snapshots.decision.exists ? snapshots.decision.data() : {};
  const communicationsAlreadySelected = sameIds(selectedIds(beforeDecision.communications), [mediaId]);
  const direction = beforeDecision.direction || emptySide("director");
  const override = beforeDecision.override || emptyOverride();
  if (override.active === true && override.actorRole === "director") throw new Error("Un override actif de la direction existe; intervention manuelle requise.");
  const directionIds = selectedIds(direction);
  const agreement = directionIds.length
    ? (sameIds(directionIds, [mediaId])
      ? { status: "agreed", mediaIds: [mediaId], divergent: false }
      : { status: "divergent", mediaIds: [], divergent: true })
    : { status: "pending", mediaIds: [], divergent: false };
  const nextWorkflowStage = agreement.status === "agreed" && snapshots.workflow.data().stage !== "published"
    ? "final_approved"
    : snapshots.workflow.data().stage;
  const nextDecision = {
    eventId,
    schemaVersion: 2,
    communications: {
      status: "selected",
      mediaIds: [mediaId],
      actorUid: actor.uid,
      actorLabel,
      actorRole: "admin",
      decidedAt: FieldValue.serverTimestamp()
    },
    direction,
    override: override.active === true ? override : emptyOverride(),
    agreement,
    textGateStage: nextWorkflowStage,
    lastMutationId: mutationId,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
    updatedByLabel: actorLabel
  };
  const nextMedia = {
    label: "Proposition retenue par les communications · Les détails qui comptent — vraie photo terrain",
    note: "Composition 4:5 issue de l’archive interne Photos/Photos Vincent/Photos videos plongees/20220510_115415.jpg. La scène et les personnes sont conservées; seul le cadrage, une légère patine et le lettrage manuscrit ont été ajoutés. Droits de diffusion confirmés par les communications le 10 août 2026.",
    rightsStatus: "photographie interne Bleu Massawippi",
    rightsConfirmed: true,
    rightsConfirmedAt: FieldValue.serverTimestamp(),
    rightsConfirmedBy: actor.uid,
    rightsConfirmedByLabel: actorLabel,
    publicationBlocked: false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid
  };
  const plannedWrites = snapshots.archive.exists ? 0 : 2 + Number(!communicationsAlreadySelected) + Number(nextWorkflowStage !== snapshots.workflow.data().stage);

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    eventId,
    mediaId,
    actorLabel,
    rightsBefore: beforeMedia.rightsStatus || "",
    rightsAfter: nextMedia.rightsStatus,
    directionChoicePreserved: directionIds,
    agreementAfter: agreement.status,
    workflowBefore: snapshots.workflow.data().stage,
    workflowAfter: nextWorkflowStage,
    plannedWrites,
    writes: apply ? plannedWrites : 0
  }, null, 2));
  if (!apply || snapshots.archive.exists) process.exitCode = 0;
  else {
    await db.runTransaction(async (transaction) => {
      const [mediaCurrent, decisionCurrent, workflowCurrent, archiveCurrent] = await Promise.all([
        transaction.get(refs.media), transaction.get(refs.decision), transaction.get(refs.workflow), transaction.get(refs.archive)
      ]);
      if (archiveCurrent.exists) return;
      if (!mediaCurrent.exists || mediaCurrent.data().eventId !== eventId) throw new Error("Le média a changé depuis le dry-run.");
      if (!workflowCurrent.exists || workflowCurrent.data().stage !== snapshots.workflow.data().stage) throw new Error("Le workflow a changé depuis le dry-run; relancer sans écraser l’interaction récente.");
      const currentDecision = decisionCurrent.exists ? decisionCurrent.data() : {};
      const currentCommunications = selectedIds(currentDecision.communications);
      if (currentCommunications.length && !sameIds(currentCommunications, [mediaId])) throw new Error("Le choix des communications a changé; intervention manuelle requise.");
      transaction.update(refs.media, nextMedia);
      const decisionNeedsWrite = !sameIds(currentCommunications, [mediaId]);
      if (decisionNeedsWrite) transaction.set(refs.decision, nextDecision);
      if (nextWorkflowStage !== workflowCurrent.data().stage) {
        transaction.set(refs.workflow, { eventId, stage: nextWorkflowStage, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid, updatedByLabel: actorLabel });
      }
      transaction.set(refs.archive, {
        entityType: "mediaDecision",
        entityId: eventId,
        action: "droits confirmés et média du 15 août recommandé par les communications",
        before: {
          media: { rightsStatus: beforeMedia.rightsStatus || "", publicationBlocked: beforeMedia.publicationBlocked === true },
          decision: beforeDecision,
          workflow: snapshots.workflow.data()
        },
        after: {
          media: { rightsStatus: nextMedia.rightsStatus, publicationBlocked: false, rightsConfirmedBy: actor.uid },
          decision: decisionNeedsWrite ? nextDecision : currentDecision,
          workflow: { eventId, stage: nextWorkflowStage }
        },
        actorUid: actor.uid,
        actorLabel,
        createdAt: FieldValue.serverTimestamp()
      });
    });
    console.log("Choix du 15 août et confirmation des droits appliqués avec archive avant/après.");
  }
} finally {
  await deleteApp(app);
}
