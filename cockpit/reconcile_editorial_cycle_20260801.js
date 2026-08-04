import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-editorial-cycle-20260801");
const BLUE_DAY_EVENT_ID = "alt-20260717";
const BLUE_DAY_MEDIA_ID = "editorial-alt-20260717-blue-day-heart-v4";
const BLUE_DAY_TASK_ID = "media-choice-alt-20260717";
const BLUE_DAY_MUTATION_ID = "editorial-cycle-20260801-alt-20260717-direction-agreement";
const BULLHEAD_EVENT_ID = "barbotte-20260730-signalement";
const BULLHEAD_MUTATION_ID = "editorial-cycle-20260801-barbotte-reset";
const SAMPLING_MEDIA_ID = "editorial-s1d2-lake-sampling-real-v3";
const SAMPLING_MUTATION_ID = "editorial-cycle-20260801-s1d2-direction-preference";
const here = path.dirname(fileURLToPath(import.meta.url));
const samplingManifest = JSON.parse(fs.readFileSync(path.join(here, "editorial_media_manifest.json"), "utf8"))
  .find((item) => item.id === SAMPLING_MEDIA_ID);
if (!samplingManifest) throw new Error("La préférence média s1d2 manque au manifeste éditorial.");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-editorial-cycle-20260801 après vérification du dry-run.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);
const sameVersion = (before, current) => before.exists === current.exists && (!before.exists || before.updateTime?.isEqual?.(current.updateTime));
const emptySide = (role) => ({ status: "none", mediaIds: [], actorUid: "", actorLabel: "", actorRole: role, decidedAt: null });
const emptyOverride = () => ({ active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null });

async function reconcileBlueDay() {
  const refs = {
    media: db.doc(`mediaLinks/${BLUE_DAY_MEDIA_ID}`),
    decision: db.doc(`mediaDecisions/${BLUE_DAY_EVENT_ID}`),
    workflow: db.doc(`workflowStates/${BLUE_DAY_EVENT_ID}`),
    task: db.doc(`tasks/${BLUE_DAY_TASK_ID}`),
    archive: db.doc(`changeArchive/${BLUE_DAY_MUTATION_ID}`)
  };
  const initial = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await ref.get()])));
  if (initial.archive.exists) return { operation: "blue-day", noOp: true };
  if (!initial.media.exists || initial.media.data().eventId !== BLUE_DAY_EVENT_ID || initial.media.data().publicationBlocked === true || initial.media.data().archived === true) {
    throw new Error("Le visuel retenu pour Votre journée en bleu n’est plus sélectionnable.");
  }
  if (!initial.decision.exists || !initial.workflow.exists || !initial.task.exists) throw new Error("État incomplet pour Votre journée en bleu.");
  const decisionBefore = initial.decision.data();
  const workflowBefore = initial.workflow.data();
  const taskBefore = initial.task.data();
  const directionIds = decisionBefore.direction?.status === "selected" ? decisionBefore.direction.mediaIds || [] : [];
  if (directionIds.length !== 1 || directionIds[0] !== BLUE_DAY_MEDIA_ID) throw new Error("Le choix actuel de la direction a changé; aucune approbation automatique.");
  if (String(workflowBefore.stage || "proposal") !== "content_approved") throw new Error("Le stade du texte a changé; relire avant d’accorder les deux rôles.");
  if (taskBefore.status !== "pending") throw new Error("La tâche de choix média n’est plus en attente; relire avant toute écriture.");
  const now = FieldValue.serverTimestamp();
  const communications = { status: "selected", mediaIds: [BLUE_DAY_MEDIA_ID], actorUid: actor.uid, actorLabel, actorRole: "admin", decidedAt: now };
  const decisionAfter = {
    ...decisionBefore,
    eventId: BLUE_DAY_EVENT_ID,
    schemaVersion: 2,
    communications,
    direction: decisionBefore.direction,
    override: emptyOverride(),
    agreement: { status: "agreed", mediaIds: [BLUE_DAY_MEDIA_ID], divergent: false },
    textGateStage: "content_approved",
    lastMutationId: BLUE_DAY_MUTATION_ID,
    updatedAt: now,
    updatedBy: actor.uid,
    updatedByLabel: actorLabel
  };
  const workflowAfter = { ...workflowBefore, stage: "final_approved", updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel };
  const taskAfter = {
    ...taskBefore,
    status: "done",
    completionReason: "Le visuel choisi par la direction est accepté par les communications; les deux rôles sont maintenant d’accord.",
    completedAt: now,
    completedBy: actor.uid,
    completedByLabel: actorLabel,
    updatedAt: now,
    updatedBy: actor.uid
  };
  if (APPLY) {
    await db.runTransaction(async (transaction) => {
      const current = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await transaction.get(ref)])));
      if (current.archive.exists) return;
      if (!["media", "decision", "workflow", "task"].every((key) => sameVersion(initial[key], current[key]))) throw new Error("Votre journée en bleu a changé depuis le dry-run; relancer sans écraser le nouvel état.");
      transaction.set(refs.decision, decisionAfter);
      transaction.set(refs.workflow, workflowAfter);
      transaction.set(refs.task, taskAfter);
      transaction.set(refs.archive, {
        entityType: "mediaDecision",
        entityId: BLUE_DAY_EVENT_ID,
        action: "accord des communications ajouté au choix explicite de la direction",
        before: { decision: decisionBefore, workflow: workflowBefore, task: taskBefore },
        after: { decision: decisionAfter, workflow: workflowAfter, task: taskAfter },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });
  }
  return { operation: "blue-day", noOp: false, workflowBefore: workflowBefore.stage, workflowAfter: "final_approved", mediaId: BLUE_DAY_MEDIA_ID };
}

async function resetBullheadMedia() {
  const refs = {
    decision: db.doc(`mediaDecisions/${BULLHEAD_EVENT_ID}`),
    workflow: db.doc(`workflowStates/${BULLHEAD_EVENT_ID}`),
    archive: db.doc(`changeArchive/${BULLHEAD_MUTATION_ID}`)
  };
  const initial = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await ref.get()])));
  if (initial.archive.exists) return { operation: "bullhead-reset", noOp: true };
  if (!initial.workflow.exists || String(initial.workflow.data().stage || "") !== "proposal") throw new Error("La barbote n’est plus au stade proposition; ne pas réinitialiser automatiquement.");
  const decisionBefore = initial.decision.exists ? initial.decision.data() : {};
  const hasStaleChoice = decisionBefore.communications?.status === "selected"
    || decisionBefore.direction?.status === "selected"
    || decisionBefore.override?.active === true
    || ["agreed", "overridden", "divergent"].includes(String(decisionBefore.agreement?.status || ""));
  if (!hasStaleChoice) return { operation: "bullhead-reset", noOp: true, alreadyNeutral: true };
  const now = FieldValue.serverTimestamp();
  const decisionAfter = {
    eventId: BULLHEAD_EVENT_ID,
    schemaVersion: 2,
    communications: emptySide("admin"),
    direction: emptySide("director"),
    override: emptyOverride(),
    agreement: { status: "pending", mediaIds: [], divergent: false },
    textGateStage: "proposal",
    lastMutationId: BULLHEAD_MUTATION_ID,
    updatedAt: now,
    updatedBy: actor.uid,
    updatedByLabel: actorLabel
  };
  if (APPLY) {
    await db.runTransaction(async (transaction) => {
      const current = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await transaction.get(ref)])));
      if (current.archive.exists) return;
      if (!["decision", "workflow"].every((key) => sameVersion(initial[key], current[key]))) throw new Error("La barbote a changé depuis le dry-run; relancer sans écraser le nouvel état.");
      transaction.set(refs.decision, decisionAfter);
      transaction.set(refs.archive, {
        entityType: "mediaDecision",
        entityId: BULLHEAD_EVENT_ID,
        action: "ancien choix média retiré après remise à zéro explicite du texte et du visuel",
        before: { decision: decisionBefore, workflow: initial.workflow.data() },
        after: { decision: decisionAfter, workflow: initial.workflow.data() },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });
  }
  return { operation: "bullhead-reset", noOp: false, workflow: "proposal", staleChoiceCleared: true };
}

async function syncSamplingPreference() {
  const refs = {
    media: db.doc(`mediaLinks/${SAMPLING_MEDIA_ID}`),
    archive: db.doc(`changeArchive/${SAMPLING_MUTATION_ID}`)
  };
  const initial = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => [key, await ref.get()])));
  if (initial.archive.exists) return { operation: "sampling-preference", noOp: true };
  if (!initial.media.exists) throw new Error("Le média préféré pour le suivi du lac est introuvable.");
  const before = initial.media.data();
  if (before.eventId !== samplingManifest.eventId) throw new Error("Le média préféré ne cible plus le bon événement.");
  const desired = {
    label: samplingManifest.label,
    note: samplingManifest.note,
    altText: samplingManifest.altText,
    rightsStatus: samplingManifest.rightsStatus,
    stage: samplingManifest.stage || "proposal",
    publicationBlocked: true,
    archived: false,
    selectedFinal: false
  };
  const unchanged = Object.entries(desired).every(([key, value]) => JSON.stringify(before[key] ?? null) === JSON.stringify(value ?? null));
  if (unchanged) return { operation: "sampling-preference", noOp: true, alreadySynchronized: true };
  const now = FieldValue.serverTimestamp();
  if (APPLY) {
    await db.runTransaction(async (transaction) => {
      const [currentMedia, currentArchive] = await Promise.all([transaction.get(refs.media), transaction.get(refs.archive)]);
      if (currentArchive.exists) return;
      if (!sameVersion(initial.media, currentMedia)) throw new Error("La préférence de suivi du lac a changé depuis le dry-run; relancer.");
      transaction.set(refs.media, { ...desired, updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel }, { merge: true });
      transaction.set(refs.archive, {
        entityType: "mediaLink",
        entityId: SAMPLING_MEDIA_ID,
        action: "préférence de la direction documentée sans contourner les droits",
        before,
        after: { ...before, ...desired },
        actorUid: actor.uid,
        actorLabel,
        createdAt: now
      });
    });
  }
  return { operation: "sampling-preference", noOp: false, publicationBlocked: true };
}

try {
  const results = [await reconcileBlueDay(), await resetBullheadMedia(), await syncSamplingPreference()];
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", actor: actorLabel, results }, null, 2));
} finally {
  await deleteApp(app);
}
