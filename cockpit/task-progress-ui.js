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

export function workflowSyncIsUsable(sync = "server", { safeMode = false, offline = false } = {}) {
  return sync === "server" || (sync === "cache" && (safeMode || offline));
}

export function actionTaskEmptyMarkup(current = true) {
  return current
    ? '<p class="cockpit-task-empty">Aucune tâche en attente. Les décisions acceptées et les éléments marqués comme complétés disparaissent de cette liste.</p>'
    : '<p class="cockpit-task-empty" data-task-syncing>Synchronisation des tâches avec le serveur… Les états enregistrés sur cet appareil ne sont pas présentés comme actuels.</p>';
}

function taskPlanDate(task) {
  if (task.targetType !== "schedule") return null;
  const item = Array.isArray(globalThis.posts) ? globalThis.posts.find((post) => post.id === task.targetId) : null;
  const match = String(item?.dateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
}

export function actionTaskPriority(task, now = new Date()) {
  const date = taskPlanDate(task);
  if (!date) return { bucket:3, dateValue:Number.POSITIVE_INFINITY, label:"Consigne active sans échéance datée" };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const distance = Math.round((target - today) / 86400000);
  if (distance < 0) return { bucket:0, dateValue:target.valueOf(), label:"Échéance passée — à traiter maintenant" };
  if (distance === 0) return { bucket:1, dateValue:target.valueOf(), label:"Prévu aujourd’hui" };
  if (distance <= 2) return { bucket:2, dateValue:target.valueOf(), label:distance === 1 ? "Prévu demain" : "Prévu dans les 48 h" };
  return { bucket:4, dateValue:target.valueOf(), label:"À préparer pour la date prévue" };
}

export function actionTaskEstimate(task) {
  const text = `${task?.title || ""} ${task?.message || ""}`.toLocaleLowerCase("fr");
  if (task?.targetType === "section") return 25;
  if (/approuver|valider|choisir|confirmer/.test(text)) return 5;
  if (/commentaire|consigne|répondre/.test(text)) return 15;
  if (/publier|programmer|terminer/.test(text)) return 10;
  if (/réviser|corriger|produire|préparer|intégrer/.test(text)) return 25;
  return 15;
}

export function renderActionTaskCard({ task, priorityLabel, estimate, when, updatedAt, workflow, mediaDecision }) {
  const isComment = String(task.id || "").startsWith("comment-");
  const progress = !isComment && task.targetType === "schedule" ? buildTaskProgressPresentation(workflow, mediaDecision) : { className:"", badge:"", markup:"" };
  return `<article class="cockpit-task-item${isComment ? " comment-task" : ""}${progress.className}" data-task-id="${esc(task.id)}" data-task-target-type="${esc(task.targetType || "schedule")}" data-task-target="${esc(task.targetId || "")}" data-task-updated-at="${updatedAt}">${isComment ? `<span class="cockpit-task-source">💬 Nouvelle consigne · ${esc(task.createdByLabel || "Direction")}</span>` : ""}${progress.badge}<b>${esc(task.title || "Tâche à accomplir")}</b><small>${esc(task.targetLabel || task.targetId || "Cible non précisée")} · ${esc(when)}</small>${progress.markup}<span class="cockpit-task-priority">Pourquoi maintenant · ${esc(priorityLabel)}</span><span class="cockpit-task-estimate" aria-label="Durée approximative ${estimate} minutes">≈ ${estimate} min</span><p>${esc(task.message || "")}</p><div class="cockpit-task-actions"><button type="button" data-open-task="${esc(task.id)}" data-task-target-type="${esc(task.targetType || "schedule")}" data-task-target="${esc(task.targetId || "")}">Ouvrir</button><button type="button" data-complete-task="${esc(task.id)}">Marquer complétée</button></div></article>`;
}
