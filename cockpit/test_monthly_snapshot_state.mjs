import assert from "node:assert/strict";
import { classifyMonthlyPostState } from "./monthly-snapshot-state.js";

const stateFor = (overrides = {}) => classifyMonthlyPostState(overrides).key;

assert.equal(stateFor(), "new", "Une proposition intacte doit être rouge.");
assert.equal(stateFor({ workflowStage: "proposal", comments: [{ comment: "À préciser", resolved: false, deleted: false }] }), "editing",
  "Le premier commentaire doit faire passer la proposition en cours d’édition.");
assert.equal(stateFor({ workflowStage: "proposal", comments: [{ comment: "Traité", resolved: true, deleted: false }] }), "editing",
  "Un commentaire traité doit continuer de prouver que le travail a commencé.");
assert.equal(stateFor({ workflowStage: "proposal", comments: [{ comment: "Archivé", deleted: true }] }), "editing",
  "Un commentaire archivé doit continuer de prouver que le travail a commencé.");

for (const workflowStage of ["content_review", "changes_requested", "content_approved", "media_review", "final_approved"]) {
  assert.equal(stateFor({ workflowStage }), "editing", `${workflowStage} doit être orange.`);
}
for (const workflowStage of ["scheduled", "published"]) {
  assert.equal(stateFor({ workflowStage }), "ready", `${workflowStage} doit être vert.`);
}

assert.equal(stateFor({ scheduleStatus: "needs_work" }), "editing", "Un statut à retravailler doit être orange.");
assert.equal(stateFor({ scheduleStatus: "approved" }), "editing", "Une approbation non publiée doit rester orange.");
assert.equal(stateFor({ editorialDecision: "chosen" }), "editing", "Une proposition retenue a déjà été travaillée.");
assert.equal(stateFor({ mediaDecision: { direction: { status: "selected" } } }), "editing", "Un choix média doit être orange.");
assert.equal(stateFor({ workflowStage: "published", comments: [{ comment: "Correction", deleted: false }] }), "ready",
  "La publication reste verte même si son historique contient un commentaire.");

console.log("✓ classification mensuelle rouge / orange / verte");
