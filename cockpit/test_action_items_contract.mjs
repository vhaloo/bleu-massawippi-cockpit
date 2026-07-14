import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [client, actionUi, view, rules, indexes, reconcile] = await Promise.all([
  readFile(new URL("./firebase-client.js", import.meta.url), "utf8"),
  readFile(new URL("./action-items-ui.js", import.meta.url), "utf8"),
  readFile(new URL("./view-mode.js", import.meta.url), "utf8"),
  readFile(new URL("./firestore.rules", import.meta.url), "utf8"),
  readFile(new URL("./firestore.indexes.json", import.meta.url), "utf8"),
  readFile(new URL("./reconcile_m0_libellule_action.js", import.meta.url), "utf8")
]);

const subscription = client.slice(client.indexOf("export function subscribePersonalActionItems"), client.indexOf("export async function updateCockpitFeedbackStatus"));
assert.match(subscription, /where\("assigneeUid", "==", profile\.uid\)/);
assert.match(subscription, /where\("assigneeRole", "==", profile\.role\)/);
assert.match(subscription, /where\("state", "==", "pending"\)/);
assert.match(subscription, /orderBy\("priorityKey", "asc"\)[\s\S]*orderBy\("eventDateIso", "asc"\)[\s\S]*orderBy\(documentId\(\), "asc"\)/);
assert.equal((subscription.match(/onSnapshot\(/g) || []).length, 1, "Un seul listener est autorisé pour la fenêtre vivante.");
assert.match(subscription, /startAfter\(pageCursor\)/);
assert.match(subscription, /getDocs\(/);
assert.doesNotMatch(subscription, /offset\s*\(/i);
assert.match(subscription, /profile\.role === "director" \? 5 : 7/);
const stateMutation = client.slice(client.indexOf("export async function setPersonalActionItemState"), client.indexOf("export async function updateCockpitFeedbackStatus"));
assert.match(stateMutation, /updateDoc\(doc\(db, "actionItems", actionItemId\)/);
assert.doesNotMatch(stateMutation, /getDoc|getDocs|onSnapshot/, "La sortie de file ne doit ajouter aucune lecture.");
assert.match(subscription, /setLocalState\(actionItemId, nextState\)[\s\S]*retainedPages = retainedPages\.map/);
assert.match(actionUi, /cockpit:action-item-state-saved[\s\S]*setLocalState/);

assert.match(actionUi, /dataset\.error && activeProfile[\s\S]*setupPersonalActionItems\(activeProfile, true\)/, "Le réessai doit recréer le listener après une erreur.");
assert.match(view, /data-vm-media=/);
assert.match(view, /mediaId: target\.dataset\.vmMedia/);
assert.match(view, /cockpit:load-more-action-items/);
assert.match(view, /approve_text_then_media/);
assert.match(view, /\["final_approved", "scheduled", "published"\]/);

assert.match(rules, /match \/actionItems\/\{actionItemId\}/);
assert.match(rules, /resource\.data\.assigneeUid == request\.auth\.uid[\s\S]*resource\.data\.assigneeRole == userRole\(\)/);
assert.match(rules, /request\.query\.limit != null && request\.query\.limit <= 25/);
assert.match(rules, /request\.resource\.data\.state == 'pending'/);
assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['state', 'updatedAt', 'updatedBy', 'lastMutationId'\]\)/);
assert.match(rules, /match \/actionItems\/[\s\S]*allow delete: if false;/);

const indexConfig = JSON.parse(indexes);
const actionIndex = indexConfig.indexes.find((item) => item.collectionGroup === "actionItems");
assert.ok(actionIndex);
assert.deepEqual(actionIndex.fields.map((field) => field.fieldPath), ["assigneeUid", "assigneeRole", "state", "priorityKey", "eventDateIso", "__name__"]);

assert.match(reconcile, /nature-alt-20260715-libellule-manuscript-v5-scientific-bilingual/);
assert.match(reconcile, /const APPLY = process\.argv\.includes\("--apply"\)/);
assert.match(reconcile, /--confirm-known-intent/);
assert.match(reconcile, /PLAN_MAITRE_OPTIMISATION_COCKPIT_2026-07-14\.md/);
assert.match(reconcile, /directionSide = beforeDecision\.direction \|\| emptySide\("director"\)/, "La direction ne doit jamais être approuvée automatiquement.");
assert.match(reconcile, /actorRole: ""/);
assert.match(reconcile, /Valider le texte, puis le visuel recommandé de la libellule/);
assert.match(reconcile, /archiveSnap\.exists[\s\S]*noOp: true/);
assert.match(reconcile, /currentArchive\.exists/);
assert.match(reconcile, /sameSnapshotVersion\(mediaSnap, currentMedia\)[\s\S]*sameSnapshotVersion\(actionSnap, currentAction\)/);
assert.match(reconcile, /État modifié depuis la lecture ciblée/);

console.log("✓ Contrat actionItems : requête bornée, rôle, pagination, règles, index et réconciliation M0.");
