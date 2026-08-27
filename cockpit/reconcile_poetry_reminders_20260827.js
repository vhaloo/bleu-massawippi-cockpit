import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-poetry-reminders-20260827");
if (APPLY && !CONFIRM) {
  throw new Error("Relancer avec --apply --confirm-poetry-reminders-20260827 après vérification du dry-run.");
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");

const REMINDERS = [
  {
    eventId: "poesie-20260829-rappel-demain",
    mediaId: "editorial-poesie-20260829-rappel-demain-v8",
    dateIso: "2026-08-29"
  },
  {
    eventId: "poesie-20260830-rappel-aujourdhui",
    mediaId: "editorial-poesie-20260830-rappel-aujourdhui-v8",
    dateIso: "2026-08-30"
  }
];

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
  const results = [];

  for (const reminder of REMINDERS) {
    const mutationId = `poetry-reminder-20260827-${reminder.eventId}`.slice(0, 160);
    const refs = {
      schedule: db.doc(`scheduleItems/${reminder.eventId}`),
      media: db.doc(`mediaLinks/${reminder.mediaId}`),
      workflow: db.doc(`workflowStates/${reminder.eventId}`),
      decision: db.doc(`mediaDecisions/${reminder.eventId}`),
      archive: db.doc(`changeArchive/${mutationId}`)
    };
    const initial = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await ref.get()])));
    if (!initial.schedule.exists || initial.schedule.data().dateIso !== reminder.dateIso) {
      throw new Error(`${reminder.eventId}: la publication doit d’abord être synchronisée au ${reminder.dateIso}.`);
    }
    if (!initial.media.exists || initial.media.data().eventId !== reminder.eventId) {
      throw new Error(`${reminder.eventId}: l’affiche V8 réutilisée doit d’abord être synchronisée.`);
    }
    if (initial.media.data().publicationBlocked === true || initial.media.data().archived === true) {
      throw new Error(`${reminder.eventId}: le média confirmé n’est plus sélectionnable.`);
    }

    const finalState = initial.workflow.exists
      && initial.workflow.data().stage === "content_review"
      && initial.decision.exists
      && sameIds(selectedIds(initial.decision.data().communications), [reminder.mediaId])
      && initial.decision.data().agreement?.status === "pending";
    if (initial.archive.exists) {
      if (!finalState) throw new Error(`${reminder.eventId}: l’archive existe, mais l’état final est incohérent.`);
      results.push({ ...reminder, noOp: true, workflowAfter: "content_review", mediaSelectedByCommunications: true });
      continue;
    }

    const workflowBefore = initial.workflow.exists ? initial.workflow.data() : { eventId: reminder.eventId, stage: "proposal" };
    const decisionBefore = initial.decision.exists ? initial.decision.data() : {};
    if (!["proposal", "content_review"].includes(String(workflowBefore.stage || "proposal"))) {
      throw new Error(`${reminder.eventId}: le workflow a déjà avancé (${workflowBefore.stage}); ne pas écraser cette interaction.`);
    }
    const previousCommunications = selectedIds(decisionBefore.communications);
    if (previousCommunications.length && !sameIds(previousCommunications, [reminder.mediaId])) {
      throw new Error(`${reminder.eventId}: les communications ont déjà choisi un autre média.`);
    }
    const direction = decisionBefore.direction || emptySide("director");
    if (selectedIds(direction).length || decisionBefore.override?.active === true) {
      throw new Error(`${reminder.eventId}: une décision de la direction existe déjà; ne pas la remplacer.`);
    }

    const now = FieldValue.serverTimestamp();
    const communications = {
      status: "selected",
      mediaIds: [reminder.mediaId],
      actorUid: actor.uid,
      actorLabel,
      actorRole: "admin",
      decidedAt: now
    };
    const workflowAfter = {
      eventId: reminder.eventId,
      stage: "content_review",
      updatedAt: now,
      updatedBy: actor.uid,
      updatedByLabel: actorLabel
    };
    const decisionAfter = {
      eventId: reminder.eventId,
      schemaVersion: 2,
      communications,
      direction,
      override: emptyOverride(),
      agreement: { status: "pending", mediaIds: [], divergent: false },
      textGateStage: "content_review",
      lastMutationId: mutationId,
      updatedAt: now,
      updatedBy: actor.uid,
      updatedByLabel: actorLabel
    };

    if (APPLY) await db.runTransaction(async (transaction) => {
      const current = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await transaction.get(ref)])));
      if (current.archive.exists) return;
      for (const key of ["schedule", "media", "workflow", "decision"]) {
        if (!sameVersion(initial[key], current[key])) {
          throw new Error(`${reminder.eventId}: l’état a changé depuis le dry-run; relancer sans écraser la nouvelle interaction.`);
        }
      }
      transaction.set(refs.workflow, workflowAfter, { merge: true });
      transaction.set(refs.decision, decisionAfter);
      transaction.set(refs.archive, {
        entityType: "mediaDecision",
        entityId: reminder.eventId,
        action: "rappel Au bord du bleu soumis à la direction avec l’affiche V8 retenue par les communications",
        before: {
          workflow: workflowBefore,
          decision: decisionBefore,
          scheduleDateIso: initial.schedule.data().dateIso,
          mediaId: reminder.mediaId
        },
        after: {
          workflow: workflowAfter,
          decision: decisionAfter,
          scheduleDateIso: reminder.dateIso,
          mediaId: reminder.mediaId
        },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });
    results.push({ ...reminder, noOp: false, workflowBefore: workflowBefore.stage || "proposal", workflowAfter: "content_review", mediaSelectedByCommunications: true, writes: 3 });
  }

  console.log(JSON.stringify({
    mode: APPLY ? "apply" : "dry-run",
    actor: actorLabel,
    operations: results.length,
    estimatedWrites: results.reduce((sum, item) => sum + Number(item.writes || 0), 0),
    safeguards: {
      directionDecisionInvented: false,
      completionChanged: false,
      scheduledOrPublishedChanged: false,
      sourcePoster: "editorial-poesie-20260821-invitation-v8"
    },
    results
  }, null, 2));
} finally {
  await deleteApp(app);
}
