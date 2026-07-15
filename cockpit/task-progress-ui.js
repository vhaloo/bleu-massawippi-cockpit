const textStages = new Set(["content_approved","media_review","final_approved","scheduled","published"]);
const finalStages = new Set(["final_approved","scheduled","published"]);
const publicationStages = new Set(["scheduled","published"]);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);

export function buildTaskProgressPresentation(workflow = {}, mediaDecision = null) {
  const stage = workflow?.stage || "proposal";
  const text = textStages.has(stage);
  const media = mediaDecision
    ? (mediaDecision.direction?.status === "selected" && mediaDecision.direction.mediaIds?.length > 0)
      || ["agreed","overridden"].includes(mediaDecision.agreement?.status)
    : finalStages.has(stage);
  const publication = publicationStages.has(stage);
  const ready = Boolean(text && media);
  const step = (label, done) => `<span class="${done ? "done" : ""}">${done ? "✓ " : ""}${label}</span>`;
  const aria = `Avancement : texte ${text ? "approuvé" : "à valider"}; visuel ${media ? "approuvé" : "à valider"}; publication ${publication ? "terminée" : "à terminer"}`;
  return {
    className: `${ready ? " workflow-ready" : ""}${publication ? " workflow-finished" : ""}`,
    badge: ready ? `<span class="cockpit-task-ready">✓ ${publication ? "Terminé" : "Texte et visuel validés"}</span>` : "",
    markup: `<div class="cockpit-task-progress" aria-label="${aria}">${step("Texte", text)}${step("Visuel", media)}${step("Terminé", publication)}</div>`,
    text,
    media,
    publication
  };
}

/**
 * Une tâche peut rester dans Firestore pour préserver l'historique sans devoir
 * rester dans la file active. La décision est dérivée des données déjà en
 * mémoire : aucune lecture ni écriture supplémentaire n'est nécessaire.
 */
export function actionTaskShouldRemain(task = {}, workflow = {}, comments = []) {
  if (task.status !== "pending") return false;
  if (task.targetType !== "schedule") return true;

  const publicationFinished = publicationStages.has(workflow?.stage || "");
  const taskId = String(task.id || "");
  if (!taskId.startsWith("comment-")) return !publicationFinished;

  const commentId = taskId.slice("comment-".length);
  const comment = Array.isArray(comments) ? comments.find((row) => String(row?.id || "") === commentId) : null;
  if (comment) return comment.deleted !== true && comment.resolved !== true;

  // Si le commentaire n'est plus dans la fenêtre bornée, une publication déjà
  // terminée ne doit pas conserver une alerte fantôme.
  return !publicationFinished;
}

export function renderActionTaskCard({ task, priorityLabel, estimate, when, updatedAt, workflow, mediaDecision }) {
  const isComment = String(task.id || "").startsWith("comment-");
  const progress = !isComment && task.targetType === "schedule" ? buildTaskProgressPresentation(workflow, mediaDecision) : { className:"", badge:"", markup:"" };
  return `<article class="cockpit-task-item${isComment ? " comment-task" : ""}${progress.className}" data-task-id="${esc(task.id)}" data-task-target-type="${esc(task.targetType || "schedule")}" data-task-target="${esc(task.targetId || "")}" data-task-updated-at="${updatedAt}">${isComment ? `<span class="cockpit-task-source">💬 Nouvelle consigne · ${esc(task.createdByLabel || "Direction")}</span>` : ""}${progress.badge}<b>${esc(task.title || "Tâche à accomplir")}</b><small>${esc(task.targetLabel || task.targetId || "Cible non précisée")} · ${esc(when)}</small>${progress.markup}<span class="cockpit-task-priority">Pourquoi maintenant · ${esc(priorityLabel)}</span><span class="cockpit-task-estimate" aria-label="Durée approximative ${estimate} minutes">≈ ${estimate} min</span><p>${esc(task.message || "")}</p><div class="cockpit-task-actions"><button type="button" data-open-task="${esc(task.id)}" data-task-target-type="${esc(task.targetType || "schedule")}" data-task-target="${esc(task.targetId || "")}">Ouvrir</button><button type="button" data-complete-task="${esc(task.id)}">Marquer complétée</button></div></article>`;
}
