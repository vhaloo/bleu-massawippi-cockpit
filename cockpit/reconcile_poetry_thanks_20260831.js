import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-poetry-thanks-20260831");
if (APPLY && !CONFIRM) {
  throw new Error("Relancer avec --apply --confirm-poetry-thanks-20260831 après vérification du dry-run.");
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");

const EVENT_ID = "poesie-20260831-remerciement-public-artistes";
const MEDIA_ID = "editorial-poesie-20260831-remerciement-groupe-v1";
const DATE_ISO = "2026-08-31";
const MUTATION_ID = "poetry-thanks-20260831-media-selection";

const emptySide = (role) => ({
  status: "none",
  mediaIds: [],
  actorUid: "",
  actorLabel: "",
  actorRole: role,
  decidedAt: null
});
const emptyOverride = () => ({
  active: false,
  mediaIds: [],
  reason: "",
  actorUid: "",
  actorLabel: "",
  actorRole: "",
  decidedAt: null
});
const selectedIds = (side) => side?.status === "selected" && Array.isArray(side.mediaIds)
  ? side.mediaIds.map(String)
  : [];
const sameIds = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const sameVersion = (before, current) => before.exists === current.exists
  && (!before.exists || before.updateTime?.isEqual?.(current.updateTime));

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

try {
  const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
  if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
  const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
  const actorLabel = String(actor.displayLabel || "Valentin Wittwe").slice(0, 120);
  const refs = {
    schedule: db.doc(`scheduleItems/${EVENT_ID}`),
    media: db.doc(`mediaLinks/${MEDIA_ID}`),
    workflow: db.doc(`workflowStates/${EVENT_ID}`),
    decision: db.doc(`mediaDecisions/${EVENT_ID}`),
    archive: db.doc(`changeArchive/${MUTATION_ID}`)
  };
  const initial = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await ref.get()])));
  if (!initial.schedule.exists || initial.schedule.data().dateIso !== DATE_ISO) {
    throw new Error(`${EVENT_ID}: la publication doit d’abord être synchronisée au ${DATE_ISO}.`);
  }
  if (!initial.media.exists || initial.media.data().eventId !== EVENT_ID) {
    throw new Error(`${EVENT_ID}: la photographie choisie doit d’abord être synchronisée.`);
  }
  if (initial.media.data().publicationBlocked === true || initial.media.data().archived === true) {
    throw new Error(`${EVENT_ID}: la photographie n’est pas sélectionnable.`);
  }

  const finalState = initial.workflow.exists
    && initial.workflow.data().stage === "content_review"
    && initial.decision.exists
    && sameIds(selectedIds(initial.decision.data().communications), [MEDIA_ID])
    && initial.decision.data().agreement?.status === "pending";
  if (initial.archive.exists) {
    if (!finalState) throw new Error(`${EVENT_ID}: l’archive existe, mais l’état final est incohérent.`);
    console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", noOp: true, eventId: EVENT_ID, mediaId: MEDIA_ID }, null, 2));
    process.exitCode = 0;
  } else {
    const workflowBefore = initial.workflow.exists ? initial.workflow.data() : { eventId: EVENT_ID, stage: "proposal" };
    const decisionBefore = initial.decision.exists ? initial.decision.data() : {};
    if (!["proposal", "content_review"].includes(String(workflowBefore.stage || "proposal"))) {
      throw new Error(`${EVENT_ID}: le workflow a déjà avancé (${workflowBefore.stage}); ne pas écraser cette interaction.`);
    }
    const previousCommunications = selectedIds(decisionBefore.communications);
    if (previousCommunications.length && !sameIds(previousCommunications, [MEDIA_ID])) {
      throw new Error(`${EVENT_ID}: les communications ont déjà choisi un autre média.`);
    }
    const direction = decisionBefore.direction || emptySide("director");
    if (selectedIds(direction).length || decisionBefore.override?.active === true) {
      throw new Error(`${EVENT_ID}: une décision de la direction existe déjà; ne pas la remplacer.`);
    }

    const now = FieldValue.serverTimestamp();
    const communications = {
      status: "selected",
      mediaIds: [MEDIA_ID],
      actorUid: actor.uid,
      actorLabel,
      actorRole: "admin",
      decidedAt: now
    };
    const workflowAfter = {
      eventId: EVENT_ID,
      stage: "content_review",
      updatedAt: now,
      updatedBy: actor.uid,
      updatedByLabel: actorLabel
    };
    const decisionAfter = {
      eventId: EVENT_ID,
      schemaVersion: 2,
      communications,
      direction,
      override: emptyOverride(),
      agreement: { status: "pending", mediaIds: [], divergent: false },
      textGateStage: "content_review",
      lastMutationId: MUTATION_ID,
      updatedAt: now,
      updatedBy: actor.uid,
      updatedByLabel: actorLabel
    };

    if (APPLY) await db.runTransaction(async (transaction) => {
      const current = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await transaction.get(ref)])));
      if (current.archive.exists) return;
      for (const key of ["schedule", "media", "workflow", "decision"]) {
        if (!sameVersion(initial[key], current[key])) {
          throw new Error(`${EVENT_ID}: l’état a changé depuis le dry-run; relancer sans écraser la nouvelle interaction.`);
        }
      }
      transaction.set(refs.workflow, workflowAfter, { merge: true });
      transaction.set(refs.decision, decisionAfter);
      transaction.set(refs.archive, {
        entityType: "mediaDecision",
        entityId: EVENT_ID,
        action: "photographie de groupe retenue par les communications et soumise à la direction",
        before: {
          workflow: workflowBefore,
          decision: decisionBefore,
          scheduleDateIso: initial.schedule.data().dateIso,
          mediaId: MEDIA_ID
        },
        after: {
          workflow: workflowAfter,
          decision: decisionAfter,
          scheduleDateIso: DATE_ISO,
          mediaId: MEDIA_ID
        },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });

    console.log(JSON.stringify({
      mode: APPLY ? "apply" : "dry-run",
      actor: actorLabel,
      eventId: EVENT_ID,
      mediaId: MEDIA_ID,
      dateIso: DATE_ISO,
      workflowBefore: workflowBefore.stage || "proposal",
      workflowAfter: "content_review",
      mediaSelectedByCommunications: true,
      estimatedWrites: APPLY ? 3 : 3,
      safeguards: {
        directionDecisionInvented: false,
        completionChanged: false,
        scheduledOrPublishedChanged: false,
        albumLinkExposed: false
      }
    }, null, 2));
  }
} finally {
  await deleteApp(app);
}
