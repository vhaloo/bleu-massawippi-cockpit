import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const CONFIRM = process.argv.includes("--confirm-editorial-cycle-20260804");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (APPLY && !CONFIRM) throw new Error("Relancer avec --apply --confirm-editorial-cycle-20260804 après le dry-run final.");

const ACCEPT_DIRECTION_CHOICES = [
  ["alt-20260807", "history-alt-20260807-ayers-cliff", "media-choice-alt-20260807"],
  ["s4d1", "editorial-s4d1-cleaning-before-holiday-v3", "media-choice-s4d1"],
  ["don-20260807-merci-bilan", "editorial-don-20260807-thanks-photo-v1", "media-choice-don-20260807-merci-bilan"]
];
const REOPEN_REVISED_COPY = [
  ["actualite-20260804-article-radio-canada-moules-zebrees", "editorial-actualite-20260809-denis-citation-science-v2", "media-choice-actualite-20260804-article-radio-canada-moules-zebrees", ["media_review"]],
  ["actualite-20260808-denis-radio-canada-moules-zebrees", "editorial-actualite-20260808-denis-radio-canada-v1", "media-choice-actualite-20260808-denis-radio-canada-moules-zebrees", ["final_approved"]]
];
const STALE_TASKS = [
  ["barbotte-20260730-signalement", "media-choice-barbotte-20260730-signalement", ["final_approved", "scheduled", "published"]],
  ["alt-20260801", "media-choice-alt-20260801", ["published"]]
];
const COMMENT_RESOLUTIONS = [
  ["nyAKDUF3MgQ6FFAAHU3H", "media-comment-nyAKDUF3MgQ6FFAAHU3H", "editorial-s4d1b-field-internal-photo-v3", "La photo terrain réelle a été intégrée; le crédit et l’autorisation des personnes visibles restent explicitement à confirmer.", {
    id: "editorial-cycle-20260804-rights-s4d1b-v1",
    sourceId: "s4d1b",
    mediaId: "editorial-s4d1b-field-internal-photo-v3",
    eventDateIso: "2026-08-15",
    priorityKey: 16,
    title: "Confirmer les droits de la photo terrain",
    message: "Une vraie photo de terrain a remplacé l’illustration. Confirmer le crédit et l’autorisation des personnes visibles; le visuel restera non sélectionnable jusqu’à cette confirmation."
  }],
  ["hnpyqjVrVYisPi3hW23c", "comment-hnpyqjVrVYisPi3hW23c", "editorial-s3d6-fridge-summer-dji0227-v2", "Le concept du frigo a été refait avec une autre photographie interne inutilisée du lac."],
  ["dHqgwxCrorVuKmkYtOqF", "comment-dHqgwxCrorVuKmkYtOqF", "project-decision-moules-zebrees-suivi-medias-20260804-v1", "La publication Meta est désormais native et sans URL de média; le lien direct reste une action distincte pour le site."],
  ["EF4A8yXxey8fGrdKVRsd", "comment-EF4A8yXxey8fGrdKVRsd", "project-decision-moules-zebrees-suivi-medias-20260804-v1", "Le lien sur le site est conservé comme action explicite à accomplir, sans annoncer une page qui n’est pas encore en ligne."],
  ["q9WiJDw836RopGnwHC1x", "comment-q9WiJDw836RopGnwHC1x", "project-decision-moules-zebrees-suivi-medias-20260804-v1", "La contrainte Meta a été vérifiée et les deux relais utilisent maintenant une publication native sans URL Radio-Canada."]
];
const RADIO_ACTION_UPDATE = {
  id: "project-decision-moules-zebrees-suivi-medias-20260804-v1",
  title: "Publier les liens Radio-Canada au bon endroit",
  message: "Les liens directs de Radio-Canada ne sont pas fiables sur Facebook et Instagram au Canada. Préparer sur le site de Bleu Massawippi un encart qui regroupe l’entrevue OHdio et l’article, puis utiliser sur Meta des publications natives sans URL de média. Conserver les liens directs pour le site et les canaux qui les acceptent; ne reprendre aucun conseil de santé sans source compétente."
};
const PLANNED_MEDIA_PREREQUISITES = new Set([
  "editorial-s4d1b-field-internal-photo-v3",
  "editorial-s3d6-fridge-summer-dji0227-v2"
]);

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);
const emptyOverride = () => ({ active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null });
const sameVersion = (before, current) => before.exists === current.exists && (!before.exists || before.updateTime?.isEqual?.(current.updateTime));
const readRefs = async (refs, transaction = null) => Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, ref]) => {
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();
  return [key, snapshot];
})));
const taskDone = (before, reason, now) => ({
  ...before,
  status: "done",
  completionReason: reason,
  completedAt: now,
  completedBy: actor.uid,
  completedByLabel: actorLabel,
  updatedAt: now,
  updatedBy: actor.uid
});

async function updateRadioAction() {
  const mutationId = "editorial-cycle-20260804-radio-action-v2";
  const refs = { action: db.doc(`actionItems/${RADIO_ACTION_UPDATE.id}`), archive: db.doc(`changeArchive/${mutationId}`) };
  const initial = await readRefs(refs);
  if (!initial.action.exists) throw new Error("L’action Radio-Canada à préciser est introuvable.");
  const before = initial.action.data();
  const alreadyCorrect = before.title === RADIO_ACTION_UPDATE.title && before.message === RADIO_ACTION_UPDATE.message;
  if (initial.archive.exists && !alreadyCorrect) throw new Error("L’archive de l’action Radio-Canada existe, mais son texte courant diffère.");
  if (alreadyCorrect) return { operation: "update-radio-action", actionId: RADIO_ACTION_UPDATE.id, noOp: true };
  if (before.state !== "pending" || before.createdByUid !== "system_project_decision" || before.actionType !== "project_decision" || before.sourceId !== "moules-zebrees-continuite") {
    throw new Error("L’action Radio-Canada n’est plus dans l’état sûr attendu.");
  }
  const now = FieldValue.serverTimestamp();
  const after = { ...before, title: RADIO_ACTION_UPDATE.title, message: RADIO_ACTION_UPDATE.message, updatedAt: now, updatedBy: actor.uid, lastMutationId: mutationId };
  if (APPLY) await db.runTransaction(async (transaction) => {
    const current = await readRefs(refs, transaction);
    if (current.archive.exists) return;
    if (!sameVersion(initial.action, current.action)) throw new Error("L’action Radio-Canada a changé depuis le dry-run.");
    transaction.set(refs.action, after);
    transaction.set(refs.archive, { entityType: "actionItem", entityId: RADIO_ACTION_UPDATE.id, action: "action Radio-Canada précisée pour Meta et le site", before, after, actorUid: actor.uid, actorLabel, createdAt: now });
  });
  return { operation: "update-radio-action", actionId: RADIO_ACTION_UPDATE.id, writes: 2 };
}

async function acceptDirectionChoice(eventId, mediaId, taskId) {
  const mutationId = `editorial-cycle-20260804-accept-${eventId}`.slice(0, 160);
  const refs = {
    media: db.doc(`mediaLinks/${mediaId}`), decision: db.doc(`mediaDecisions/${eventId}`),
    workflow: db.doc(`workflowStates/${eventId}`), task: db.doc(`tasks/${taskId}`), archive: db.doc(`changeArchive/${mutationId}`)
  };
  const initial = await readRefs(refs);
  if (initial.archive.exists) return { operation: "accept-direction", eventId, noOp: true };
  if (!initial.media.exists || initial.media.data().eventId !== eventId || initial.media.data().archived === true || initial.media.data().publicationBlocked === true) throw new Error(`${eventId}: le média retenu n’est plus sélectionnable.`);
  if (!initial.decision.exists || !initial.workflow.exists || !initial.task.exists) throw new Error(`${eventId}: état incomplet.`);
  const before = { decision: initial.decision.data(), workflow: initial.workflow.data(), task: initial.task.data() };
  if (before.workflow.stage !== "content_approved") throw new Error(`${eventId}: le texte n’est plus au stade approuvé.`);
  if (before.task.status !== "pending") throw new Error(`${eventId}: la tâche média n’est plus en attente.`);
  const directionIds = before.decision.direction?.status === "selected" ? before.decision.direction.mediaIds || [] : [];
  if (directionIds.length !== 1 || directionIds[0] !== mediaId) throw new Error(`${eventId}: le choix de la direction a changé.`);
  const now = FieldValue.serverTimestamp();
  const communications = { status: "selected", mediaIds: [mediaId], actorUid: actor.uid, actorLabel, actorRole: "admin", decidedAt: now };
  const decision = { ...before.decision, eventId, schemaVersion: 2, communications, override: emptyOverride(), agreement: { status: "agreed", mediaIds: [mediaId], divergent: false }, textGateStage: "final_approved", lastMutationId: mutationId, updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel };
  const workflow = { ...before.workflow, eventId, stage: "final_approved", updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel };
  const task = taskDone(before.task, "Le choix explicite de la direction est accepté par les communications; la publication attend maintenant seulement sa programmation.", now);
  if (APPLY) await db.runTransaction(async (transaction) => {
    const current = await readRefs(refs, transaction);
    if (current.archive.exists) return;
    if (!["media", "decision", "workflow", "task"].every((key) => sameVersion(initial[key], current[key]))) throw new Error(`${eventId}: état modifié depuis le dry-run.`);
    transaction.set(refs.decision, decision); transaction.set(refs.workflow, workflow); transaction.set(refs.task, task);
    transaction.set(refs.archive, { entityType: "mediaDecision", entityId: eventId, action: "choix de la direction accepté par les communications", before, after: { decision, workflow, task }, actorUid: actor.uid, actorLabel, createdAt: now });
  });
  return { operation: "accept-direction", eventId, mediaId, workflow: "final_approved", writes: 4 };
}

async function reopenRevisedCopy(eventId, mediaId, taskId, expectedStages) {
  const mutationId = `editorial-cycle-20260804-reopen-${eventId}`.slice(0, 160);
  const refs = {
    media: db.doc(`mediaLinks/${mediaId}`), decision: db.doc(`mediaDecisions/${eventId}`),
    workflow: db.doc(`workflowStates/${eventId}`), task: db.doc(`tasks/${taskId}`), archive: db.doc(`changeArchive/${mutationId}`)
  };
  const initial = await readRefs(refs);
  if (initial.archive.exists) return { operation: "reopen-copy", eventId, noOp: true };
  if (!initial.media.exists || initial.media.data().eventId !== eventId || initial.media.data().archived === true || initial.media.data().publicationBlocked === true) throw new Error(`${eventId}: le média retenu n’est plus sélectionnable.`);
  if (!initial.decision.exists || !initial.workflow.exists || !initial.task.exists) throw new Error(`${eventId}: état incomplet.`);
  const before = { decision: initial.decision.data(), workflow: initial.workflow.data(), task: initial.task.data() };
  if (!expectedStages.includes(before.workflow.stage)) throw new Error(`${eventId}: le stade a changé (${before.workflow.stage}).`);
  if (before.task.status !== "pending") throw new Error(`${eventId}: la tâche média n’est plus en attente.`);
  const directionIds = before.decision.direction?.status === "selected" ? before.decision.direction.mediaIds || [] : [];
  if (directionIds.length !== 1 || directionIds[0] !== mediaId) throw new Error(`${eventId}: le choix de la direction a changé.`);
  const now = FieldValue.serverTimestamp();
  const communications = before.decision.communications?.status === "selected" && (before.decision.communications.mediaIds || []).includes(mediaId)
    ? before.decision.communications
    : { status: "selected", mediaIds: [mediaId], actorUid: actor.uid, actorLabel, actorRole: "admin", decidedAt: now };
  const decision = { ...before.decision, eventId, schemaVersion: 2, communications, override: emptyOverride(), agreement: { status: "pending", mediaIds: [], divergent: false }, textGateStage: "content_review", lastMutationId: mutationId, updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel };
  const workflow = { ...before.workflow, eventId, stage: "content_review", updatedAt: now, updatedBy: actor.uid, updatedByLabel: actorLabel };
  const task = taskDone(before.task, "Le visuel choisi est conservé; le texte révisé sans URL Meta doit maintenant être relu par la direction.", now);
  if (APPLY) await db.runTransaction(async (transaction) => {
    const current = await readRefs(refs, transaction);
    if (current.archive.exists) return;
    if (!["media", "decision", "workflow", "task"].every((key) => sameVersion(initial[key], current[key]))) throw new Error(`${eventId}: état modifié depuis le dry-run.`);
    transaction.set(refs.decision, decision); transaction.set(refs.workflow, workflow); transaction.set(refs.task, task);
    transaction.set(refs.archive, { entityType: "workflowState", entityId: eventId, action: "texte Radio-Canada rouvert après adaptation Meta", before, after: { decision, workflow, task }, actorUid: actor.uid, actorLabel, createdAt: now });
  });
  return { operation: "reopen-copy", eventId, mediaId, workflow: "content_review", choicesPreserved: true, writes: 4 };
}

async function completeStaleTask(eventId, taskId, allowedStages) {
  const mutationId = `editorial-cycle-20260804-close-task-${taskId}`.slice(0, 160);
  const refs = { workflow: db.doc(`workflowStates/${eventId}`), task: db.doc(`tasks/${taskId}`), archive: db.doc(`changeArchive/${mutationId}`) };
  const initial = await readRefs(refs);
  if (initial.archive.exists || (initial.task.exists && initial.task.data().status === "done")) return { operation: "close-stale-task", eventId, noOp: true };
  if (!initial.workflow.exists || !initial.task.exists || !allowedStages.includes(initial.workflow.data().stage)) throw new Error(`${eventId}: la tâche ne peut pas être classée dans l’état actuel.`);
  const now = FieldValue.serverTimestamp();
  const before = initial.task.data();
  const task = taskDone(before, "Le choix média est déjà entièrement reflété dans le cycle; cette ancienne tâche ne doit plus rester dans la file active.", now);
  if (APPLY) await db.runTransaction(async (transaction) => {
    const current = await readRefs(refs, transaction);
    if (current.archive.exists) return;
    if (!["workflow", "task"].every((key) => sameVersion(initial[key], current[key]))) throw new Error(`${eventId}: état modifié depuis le dry-run.`);
    transaction.set(refs.task, task);
    transaction.set(refs.archive, { entityType: "task", entityId: taskId, action: "ancienne tâche média classée après validation", before, after: task, actorUid: actor.uid, actorLabel, createdAt: now });
  });
  return { operation: "close-stale-task", eventId, taskId, writes: 2 };
}

async function resolveIntegratedComment(commentId, taskId, prerequisiteId, resolutionNote, followUpAction = null) {
  const prerequisiteCollection = prerequisiteId.startsWith("project-decision-") ? "actionItems" : "mediaLinks";
  const mutationId = `editorial-cycle-20260804-comment-${commentId}`.slice(0, 160);
  const refs = { comment: db.doc(`comments/${commentId}`), task: db.doc(`tasks/${taskId}`), prerequisite: db.doc(`${prerequisiteCollection}/${prerequisiteId}`), archive: db.doc(`changeArchive/${mutationId}`) };
  if (followUpAction?.id) refs.followUp = db.doc(`actionItems/${followUpAction.id}`);
  const initial = await readRefs(refs);
  if (initial.archive.exists || (initial.comment.exists && initial.comment.data().resolved === true && initial.task.exists && initial.task.data().status === "done")) return { operation: "resolve-comment", commentId, noOp: true };
  const plannedMediaPrerequisite = !APPLY && prerequisiteCollection === "mediaLinks" && PLANNED_MEDIA_PREREQUISITES.has(prerequisiteId);
  if (!initial.comment.exists || !initial.task.exists || (!initial.prerequisite.exists && !plannedMediaPrerequisite)) throw new Error(`${commentId}: commentaire, tâche ou résultat intégré manquant.`);
  if (initial.task.data().status !== "pending") throw new Error(`${commentId}: la tâche associée a changé.`);
  if (prerequisiteCollection === "mediaLinks" && initial.prerequisite.exists && initial.prerequisite.data().archived === true) throw new Error(`${commentId}: le nouveau média est archivé.`);
  const plannedRadioAction = !APPLY && prerequisiteId === RADIO_ACTION_UPDATE.id;
  if (prerequisiteCollection === "actionItems" && !plannedRadioAction && !/sans URL|liens Radio-Canada au bon endroit/i.test(`${initial.prerequisite.data().title || ""} ${initial.prerequisite.data().message || ""}`)) throw new Error(`${commentId}: l’action Meta/site n’est pas encore synchronisée.`);
  const now = FieldValue.serverTimestamp();
  const commentBefore = initial.comment.data();
  const taskBefore = initial.task.data();
  const comment = { ...commentBefore, resolved: true, resolvedAt: now, resolvedBy: actor.uid, resolvedByLabel: actorLabel, updatedAt: now, updatedBy: actor.uid };
  const task = taskDone(taskBefore, resolutionNote, now);
  let followUp = null;
  if (followUpAction) {
    if (!/^[A-Za-z0-9_-]{3,180}$/.test(followUpAction.id) || !/^[a-z0-9-]{3,80}$/i.test(followUpAction.sourceId) || !/^[A-Za-z0-9_-]{3,180}$/.test(followUpAction.mediaId)) throw new Error(`${commentId}: suivi de droits invalide.`);
    if (!commentBefore.authorUid) throw new Error(`${commentId}: le compte de la direction est introuvable.`);
    const queueKey = `aq1|${commentBefore.authorUid.length}|${commentBefore.authorUid}|director|p|${String(followUpAction.priorityKey).padStart(4, "0")}|${followUpAction.eventDateIso}|${followUpAction.id}`;
    followUp = initial.followUp?.exists ? initial.followUp.data() : {
      assigneeUid: commentBefore.authorUid,
      assigneeRole: "director",
      state: "pending",
      sourceType: "schedule",
      sourceId: followUpAction.sourceId,
      mediaId: followUpAction.mediaId,
      eventDateIso: followUpAction.eventDateIso,
      actionType: "media_direction_approval",
      title: followUpAction.title,
      message: followUpAction.message,
      priorityKey: followUpAction.priorityKey,
      queueKey,
      createdByUid: actor.uid,
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.uid,
      lastMutationId: mutationId,
      schemaVersion: 1
    };
    if (initial.followUp?.exists && (followUp.assigneeUid !== commentBefore.authorUid || followUp.sourceId !== followUpAction.sourceId || followUp.mediaId !== followUpAction.mediaId)) {
      throw new Error(`${commentId}: le suivi de droits existant ne correspond plus à la photo.`);
    }
  }
  if (APPLY) await db.runTransaction(async (transaction) => {
    const current = await readRefs(refs, transaction);
    if (current.archive.exists) return;
    if (!["comment", "task", "prerequisite", ...(refs.followUp ? ["followUp"] : [])].every((key) => sameVersion(initial[key], current[key]))) throw new Error(`${commentId}: état modifié depuis le dry-run.`);
    transaction.set(refs.comment, comment); transaction.set(refs.task, task);
    if (refs.followUp && !current.followUp.exists) transaction.set(refs.followUp, followUp);
    transaction.set(refs.archive, { entityType: "comment", entityId: commentId, action: "commentaire intégré et résultat vérifié", before: { comment: commentBefore, task: taskBefore, followUp: initial.followUp?.exists ? initial.followUp.data() : null }, after: { comment, task, resolutionNote, followUp }, actorUid: actor.uid, actorLabel, createdAt: now });
  });
  return { operation: "resolve-comment", commentId, taskId, prerequisiteId, followUpActionId: followUpAction?.id || null, writes: followUpAction && !initial.followUp?.exists ? 4 : 3 };
}

try {
  const results = [];
  results.push(await updateRadioAction());
  for (const args of ACCEPT_DIRECTION_CHOICES) results.push(await acceptDirectionChoice(...args));
  for (const args of REOPEN_REVISED_COPY) results.push(await reopenRevisedCopy(...args));
  for (const args of STALE_TASKS) results.push(await completeStaleTask(...args));
  for (const args of COMMENT_RESOLUTIONS) results.push(await resolveIntegratedComment(...args));
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", actor: actorLabel, operations: results.length, estimatedWrites: results.reduce((sum, item) => sum + Number(item.writes || 0), 0), results }, null, 2));
} finally {
  await deleteApp(app);
}
