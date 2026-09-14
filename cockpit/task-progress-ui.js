import {renderMediaValidationPanel, communicationsApprovalNeedsReview} from "./media-choice-ui.js?v=20260914-b85";

const textStages = new Set(["content_approved","media_in_progress","media_review","media_changes_requested","final_approved","scheduled","published"]);
const finalStages = new Set(["final_approved","scheduled","published"]);
const publicationStages = new Set(["scheduled","published"]);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);

export function workflowMarkup(planItem) {
  return `<section class="cockpit-workflow" data-workflow><h5><span>Les 3 feux verts</span><small class="cockpit-workflow-path">📝 Texte · 🖼️ Visuel · ✓ Publication</small></h5><details class="cockpit-workflow-help"><summary>Comment ça marche ?</summary><p>Confirmez le texte et le visuel de votre côté, dans l’ordre de votre choix. Chaque avis reste distinct. Annie peut approuver une autre photo que celle recommandée. Vous pouvez retirer votre approbation et la redonner. Seul Valentin utilise « Terminé » pour confirmer la programmation ou la publication après les validations.</p></details><div class="cockpit-workflow-gates"><button type="button" class="cockpit-workflow-gate" data-gate="content" aria-pressed="false"><b>📝 1 · Texte</b><span data-gate-label>À valider</span></button><button type="button" class="cockpit-workflow-gate" data-gate="media" aria-pressed="false"><b>🖼️ 2 · Visuel</b><span data-gate-label>Choix en attente</span></button><button type="button" class="cockpit-workflow-gate" data-gate="publication" aria-pressed="false"><b>✓ 3 · Terminé</b><span data-gate-label>Publié ou programmé</span></button></div><div class="cockpit-workflow-actions" data-workflow-actions data-event-id="${esc(planItem.id)}"></div><p class="cockpit-workflow-complete" data-workflow-complete hidden>Tout est terminé. Cet événement reste conservé et consultable.</p></section>`;
}

export function buildTaskProgressPresentation(workflow = {}, mediaDecision = null) {
  const stage = workflow?.stage || "proposal";
  const text = textStages.has(stage);
  const media = mediaDecision
    ? ["agreed","overridden","direction_approved"].includes(mediaDecision.agreement?.status)
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

/**
 * Les rétroactions déposées depuis la boîte à idées générale utilisent
 * historiquement l'identifiant logique « cockpit ». Il ne correspond toutefois
 * à aucun élément du DOM. On le traduit vers la liste de rétroactions visible
 * dans le panneau d'administration afin que les anciennes comme les nouvelles
 * tâches conservent une destination ouvrable.
 */
export function visibleActionTaskTarget(type = "schedule", id = "") {
  const targetType = String(type || "schedule").trim();
  const targetId = String(id || "").trim();
  return targetType === "section" && targetId === "cockpit"
    ? "cockpit-feedback-list"
    : targetId;
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

export function renderCompletedActionTaskCard({ task, when, updatedAt }) {
  const isComment = String(task.id || "").startsWith("comment-");
  return `<article class="cockpit-task-item cockpit-task-completed${isComment ? " comment-task" : ""}" data-completed-task-id="${esc(task.id)}" data-task-target-type="${esc(task.targetType || "schedule")}" data-task-target="${esc(task.targetId || "")}" data-task-updated-at="${updatedAt}"><span class="cockpit-task-ready">✓ Traitée</span><b>${esc(task.title || "Tâche terminée")}</b><small>${esc(task.targetLabel || task.targetId || "Cible non précisée")} · ${esc(when)}</small><p>${esc(task.message || "")}</p><div class="cockpit-task-actions"><button type="button" data-open-task="${esc(task.id)}" data-task-target-type="${esc(task.targetType || "schedule")}" data-task-target="${esc(task.targetId || "")}">Revoir</button><span class="cockpit-task-lock" aria-label="Tâche verrouillée dans l’historique">🔒 Archivée</span></div></article>`;
}

export function renderWorkflowControls(card, {state, getPlanItem, stateTimestampMillis}) {
  const row = state.workflows.get(card.dataset.itemId) || { stage: "proposal" };
  const stage = row.stage || "proposal";
  const planItem = getPlanItem(card);
  const requiredMediaCount = planItem?.mediaSelectionMode === "multiple"
    ? 2
    : 1;
  const structuredMediaDecision = state.mediaDecisions.get(card.dataset.itemId) || null;
  const structuredMediaAgreement = ["agreed", "overridden", "direction_approved"].includes(structuredMediaDecision?.agreement?.status);
  const directionMediaReady = structuredMediaDecision?.direction?.status === "selected"
    && Array.isArray(structuredMediaDecision.direction.mediaIds)
    && structuredMediaDecision.direction.mediaIds.length >= requiredMediaCount;
  card.dataset.workflowStage = stage;
  card.dataset.workflowUpdatedAt = String(stateTimestampMillis(row.updatedAt));
  const contentDone = ["content_approved","media_in_progress","media_review","media_changes_requested","final_approved","scheduled","published"].includes(stage);
  const comments = state.commentsByEvent.get(card.dataset.itemId) || [];
  const communicationsTextDone = row.communicationsTextApproval?.approved === true
    && row.communicationsTextApproval.copy === String(planItem?.copy || '').trim()
    && !communicationsApprovalNeedsReview(row.communicationsTextApproval, comments);
  const mediaReviewRequested = communicationsApprovalNeedsReview(structuredMediaDecision?.communications, comments);
  const myContentDone = state.profile?.role === 'admin' ? communicationsTextDone : contentDone;
  const myMediaSide = structuredMediaDecision?.[state.profile?.role === 'admin' ? 'communications' : 'direction'];
  const myMediaDone = myMediaSide?.status === 'selected' && myMediaSide.mediaIds.length >= requiredMediaCount
    && !(state.profile?.role === 'admin' && mediaReviewRequested);
  const mediaDone = structuredMediaDecision
    ? structuredMediaAgreement && (structuredMediaDecision.agreement.mediaIds?.length || 0) >= requiredMediaCount
    : ["final_approved","scheduled","published"].includes(stage);
  const publicationDone = ["scheduled","published"].includes(stage);
  const contentGate = card.querySelector('[data-gate="content"]');
  const mediaGate = card.querySelector('[data-gate="media"]');
  const publicationGate = card.querySelector('[data-gate="publication"]');
  contentGate?.classList.toggle("done", myContentDone);
  mediaGate?.classList.toggle("done", myMediaDone);
  publicationGate?.classList.toggle("done", publicationDone);
  [contentGate,mediaGate,publicationGate].forEach((gate) => gate?.classList.remove("current"));
  if (!contentDone) contentGate?.classList.add("current"); else if (!mediaDone) mediaGate?.classList.add("current"); else if (!publicationDone) publicationGate?.classList.add("current");
  const contentLabel = contentGate?.querySelector("[data-gate-label]");
  const mediaLabel = mediaGate?.querySelector("[data-gate-label]");
  const publicationLabel = publicationGate?.querySelector("[data-gate-label]");
  if (contentLabel) contentLabel.textContent = myContentDone ? "Approuvé de mon côté" : "À confirmer de mon côté";
  if (mediaLabel) mediaLabel.textContent = mediaDone
    ? (structuredMediaDecision?.agreement?.status === "overridden" ? "Validé par override motivé" : structuredMediaDecision?.agreement?.status === "direction_approved" ? "Approuvé par la direction" : structuredMediaAgreement ? "Accord des deux rôles" : "Choisi par la direction")
    : structuredMediaDecision?.agreement?.status === "divergent"
      ? "Choix à harmoniser"
      : (directionMediaReady ? "Choix DG · accord à confirmer" : stage === "media_review" ? "Prêt pour validation" : "Choix en attente");
  const publicationReady = contentDone && mediaDone;
  if (publicationLabel) publicationLabel.textContent = publicationDone ? "Publié ou programmé" : publicationReady ? "Prêt à publier" : "Attend les 2 validations";
  const configureGate = (gate, done, canCheck, checkStage, uncheckStage, checkedName, roleAllowed = true) => {
    if (!gate) return;
    gate.setAttribute("aria-pressed", String(done));
    gate.disabled = !roleAllowed || (!done && !canCheck);
    if (roleAllowed) {
      gate.dataset.workflowStage = done ? uncheckStage : checkStage;
      gate.dataset.workflowDirection = done ? "back" : "forward";
    } else {
      delete gate.dataset.workflowStage;
      delete gate.dataset.workflowDirection;
    }
    gate.title = !roleAllowed
      ? checkedName === "Terminé" ? "Seules les communications confirment la programmation ou la publication" : "Choisissez ou retirez le média depuis la galerie"
      : done ? `Retirer le feu vert « ${checkedName} » et revenir à l’étape précédente` : canCheck ? `Donner le feu vert « ${checkedName} »` : "Terminez d’abord l’étape précédente";
  };
  configureGate(contentGate, myContentDone, true, "content_approved", "content_review", "Texte", !(state.profile?.role === "director" && ["scheduled", "published"].includes(stage)));
  if (contentGate && state.profile?.role === 'admin') {
    delete contentGate.dataset.workflowStage;
    contentGate.dataset.communicationsTextApproval = String(!communicationsTextDone);
    contentGate.title = communicationsTextDone ? 'Retirer mon approbation du texte' : 'Approuver le texte de mon côté';
  } else if (contentGate) delete contentGate.dataset.communicationsTextApproval;
  configureGate(mediaGate, myMediaDone, false, "final_approved", "media_review", "Visuel", false);
  if (mediaGate) {
    mediaGate.disabled = !["admin", "director"].includes(state.profile?.role);
    mediaGate.dataset.openMediaValidation = "true";
    mediaGate.title = "Confirmer ou modifier mon approbation du visuel";
    if (mediaLabel) mediaLabel.textContent = myMediaDone ? 'Approuvé de mon côté' : 'À confirmer de mon côté';
  }
  configureGate(publicationGate, publicationDone, publicationReady, "published", "final_approved", "Terminé", state.profile?.role === "admin");
  card.classList.toggle("workflow-complete", publicationDone);
  const completeNote = card.querySelector("[data-workflow-complete]");
  if (completeNote) completeNote.hidden = !publicationDone;
  const actions = card.querySelector("[data-workflow-actions]");
  if (!actions) return;
  const buttons = [];
  if (state.profile?.role === "admin") {
    if (["proposal","changes_requested"].includes(stage)) buttons.push(["content_review","Texte prêt — envoyer à la direction","primary"]);
    if (["content_approved", "media_in_progress", "media_changes_requested"].includes(stage) && !mediaDone) buttons.push(["media_review","Visuel prêt — envoyer à la direction","primary"]);
    if (publicationReady && !publicationDone) buttons.push(["published","✓ Terminer — publié ou programmé","primary"]);
  }
  if (state.profile?.role === "director") {
    if (["content_review","proposal","changes_requested"].includes(stage)) buttons.push(["content_approved","✓ Approuver le texte et le concept","primary"]);
    if (stage === "content_review") buttons.push(["changes_requested","Correction demandée au texte","correction"]);
    if (stage === "media_review") buttons.push(["media_changes_requested","Correction demandée au visuel","correction"]);
  }
  const waiting = publicationDone ? "Événement terminé; l’historique est conservé." : publicationReady ? "Le texte et le visuel sont approuvés. Les communications peuvent programmer ou publier." : stage === "media_review" ? "Le visuel est prêt : confirmez votre choix ou la décision finale ci-dessous." : contentDone ? "Le texte est approuvé. Le choix du visuel reste à confirmer ci-dessous." : "Le texte reste à valider. Vous pouvez déjà choisir un visuel.";
  actions.innerHTML = buttons.map(([value,label,kind]) => `<button type="button" class="${kind}" ${value ? `data-workflow-stage="${value}"` : "disabled"}>${label}</button>`).join("") || `<span class="cockpit-media-note">${esc(waiting)}</span>`;
  actions.insertAdjacentHTML('beforeend', `<p class="cockpit-media-role-summary"><span><b>Texte · Communications</b> · ${communicationsTextDone ? 'Approuvé' : 'À confirmer'}</span><span><b>Texte · Direction</b> · ${contentDone ? 'Approuvé' : 'À confirmer'}</span></p>`);
  renderMediaValidationPanel(card, {profile:state.profile, rows:state.mediaByEvent.get(card.dataset.itemId) || [], decision:structuredMediaDecision, textApproved:contentDone, multiple:requiredMediaCount > 1, loading:state.mediaContextLoading.has(card.dataset.itemId), reviewRequested:mediaReviewRequested});
}
