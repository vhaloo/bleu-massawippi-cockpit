export const monthlyPostStates = Object.freeze({
  new: Object.freeze({ key: "new", className: "is-new", symbol: "!", label: "Nouvelle proposition" }),
  editing: Object.freeze({ key: "editing", className: "is-editing", symbol: "✎", label: "En cours d’édition" }),
  ready: Object.freeze({ key: "ready", className: "is-ready", symbol: "✓", label: "Publié ou programmé" })
});

function hasEditorialComment(comments) {
  return Array.isArray(comments) && comments.some((row) => (
    row
    && String(row.comment || "").trim().length > 0
  ));
}

function hasMediaProgress(mediaDecision) {
  if (!mediaDecision || typeof mediaDecision !== "object") return false;
  return mediaDecision.communications?.status === "selected"
    || mediaDecision.direction?.status === "selected"
    || mediaDecision.override?.active === true
    || (mediaDecision.agreement?.status && mediaDecision.agreement.status !== "none");
}

export function classifyMonthlyPostState({
  workflowStage = "proposal",
  comments = [],
  scheduleStatus = "pending",
  editorialDecision = "undecided",
  mediaDecision = null
} = {}) {
  const stage = String(workflowStage || "proposal").trim().toLowerCase();
  if (["scheduled", "published"].includes(stage)) return monthlyPostStates.ready;

  const status = String(scheduleStatus || "pending").trim().toLowerCase();
  const decision = String(editorialDecision || "undecided").trim().toLowerCase();
  const workHasStarted = (stage && stage !== "proposal")
    || hasEditorialComment(comments)
    || (status && !["pending", "deleted"].includes(status))
    || (decision && decision !== "undecided")
    || hasMediaProgress(mediaDecision);

  return workHasStarted ? monthlyPostStates.editing : monthlyPostStates.new;
}
