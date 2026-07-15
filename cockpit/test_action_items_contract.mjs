import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { buildTaskProgressPresentation, renderActionTaskCard } from "./task-progress-ui.js";

const [client, cockpitUi, actionUi, view, rules, indexes, reconcile] = await Promise.all([
  readFile(new URL("./firebase-client.js", import.meta.url), "utf8"),
  readFile(new URL("./cockpit-ui.js", import.meta.url), "utf8"),
  readFile(new URL("./action-items-ui.js", import.meta.url), "utf8"),
  readFile(new URL("./view-mode.js", import.meta.url), "utf8"),
  readFile(new URL("./firestore.rules", import.meta.url), "utf8"),
  readFile(new URL("./firestore.indexes.json", import.meta.url), "utf8"),
  readFile(new URL("./reconcile_m0_libellule_action.js", import.meta.url), "utf8")
]);

const subscription = client.slice(client.indexOf("export function subscribePersonalActionItems"), client.indexOf("export async function updateCockpitFeedbackStatus"));
assert.match(subscription, /where\("queueKey", ">=", queueBounds\.lower\)/);
assert.match(subscription, /where\("queueKey", "<", queueBounds\.upper\)/);
assert.match(subscription, /orderBy\("queueKey", "asc"\)/);
assert.doesNotMatch(subscription, /where\("assigneeUid"|where\("assigneeRole"|where\("state"|orderBy\("priorityKey"|documentId\(/,
  "La file ne doit dépendre que de l’index automatique de queueKey.");
assert.equal((subscription.match(/trackedOnSnapshot\("personalActionItems"/g) || []).length, 1, "Un seul listener suivi est autorisé pour la fenêtre vivante.");
assert.match(subscription, /startAfter\(cursor\)/);
assert.match(subscription, /getDocs\(/);
assert.doesNotMatch(subscription, /offset\s*\(/i);
assert.match(subscription, /profile\.role === "director" \? 5 : 7/);
assert.match(subscription, /desiredPageCount/);
assert.match(subscription, /rebaseLoadedPages/);
assert.match(subscription, /headSignature !== expectedHead/);
assert.match(subscription, /if \(nextPage\.docs\.length\) retainedPages\.push/);
assert.match(subscription, /tailExhausted = nextPage\.docs\.length < pageSize/);
assert.match(subscription, /loading \|\| rebasing/);
assert.match(subscription, /for \(let page = 0; page < targetPageCount[\s\S]*getDocs\(pageQueryAfter\(rebaseCursor\)\)/,
  "Le rebase doit relire au plus le nombre de pages déjà demandé, sans offset.");
assert.match(subscription, /pageCursor = rebaseCursor \|\| liveDocs\.at\(-1\)/);
assert.match(subscription, /tailExhausted = exhausted;[\s\S]*hasMore = !tailExhausted/);
assert.match(subscription, /if \(!liveDocs\.length\)[\s\S]*retainedPages = \[\][\s\S]*hasMore = false/);

const pureStart = client.indexOf("function personalActionSnapshotValue");
const pureMarker = client.indexOf(" * File Firestore strictement personnelle", pureStart);
const pureEnd = client.lastIndexOf("/**", pureMarker);
assert.ok(pureStart >= 0 && pureEnd > pureStart, "Le modèle de fenêtres doit rester testable sans Firebase.");
const sandbox = {};
vm.runInNewContext(
  `${client.slice(pureStart, pureEnd).replaceAll("export function ", "function ")}\nthis.actionItemQueueKey = actionItemQueueKey; this.personalPendingActionBounds = personalPendingActionBounds; this.personalActionHeadSignature = personalActionHeadSignature; this.displacedPersonalActionHead = displacedPersonalActionHead; this.mergePersonalActionWindows = mergePersonalActionWindows;`,
  sandbox
);
const action = (id, priorityKey, title = id) => ({ id, priorityKey, eventDateIso: "2026-07-15", state: "pending", title });
const ids = (rows) => Array.from(rows, (item) => item.id);
const queueValue = (id, priorityKey, state = "pending", assignee = { uid: "uid-annie", role: "director" }) => ({
  id, priorityKey, state, eventDateIso: "2026-07-15", assigneeUid: assignee.uid, assigneeRole: assignee.role
});
assert.equal(sandbox.actionItemQueueKey(queueValue("action-a", 7)), "aq1|9|uid-annie|director|p|0007|2026-07-15|action-a");
assert.equal(sandbox.actionItemQueueKey(queueValue("action-a", 7, "done")), "aq1|9|uid-annie|director|d|0007|2026-07-15|action-a");
assert.equal(sandbox.actionItemQueueKey(queueValue("action-a", 7, "pending", { uid: "uid|annie", role: "director" })), "aq1|9|uid|annie|director|p|0007|2026-07-15|action-a");
assert.deepEqual({ ...sandbox.personalPendingActionBounds({ uid: "uid-annie", role: "director" }) }, {
  lower: "aq1|9|uid-annie|director|p|",
  upper: "aq1|9|uid-annie|director|p|\uf8ff"
});
const lexicalQueue = [queueValue("action-z", 10), queueValue("action-a", 2), queueValue("action-b", 2)]
  .map((item) => sandbox.actionItemQueueKey(item)).sort();
assert.deepEqual(lexicalQueue, [
  "aq1|9|uid-annie|director|p|0002|2026-07-15|action-a",
  "aq1|9|uid-annie|director|p|0002|2026-07-15|action-b",
  "aq1|9|uid-annie|director|p|0010|2026-07-15|action-z"
]);

// A-E sont visibles et F-J déjà chargés. L'arrivée prioritaire de X déplace E :
// E reste dans la frontière transitoire, puis le rebase depuis D relit E-I.
const initialHead = [action("a", 1), action("b", 2), action("c", 3), action("d", 4), action("e", 5)];
const initialTail = [[action("f", 6), action("g", 7), action("h", 8), action("i", 9), action("j", 10)]];
const arrivedHead = [action("x", 0), action("a", 1), action("b", 2), action("c", 3), action("d", 4)];
const displaced = sandbox.displacedPersonalActionHead(initialHead, arrivedHead);
assert.deepEqual(ids(displaced), ["e"]);
assert.deepEqual(ids(sandbox.mergePersonalActionWindows(arrivedHead, initialTail, displaced)), ["x", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
const rebasedAfterArrival = [[action("e", 5), action("f", 6), action("g", 7), action("h", 8), action("i", 9)]];
assert.deepEqual(ids(sandbox.mergePersonalActionWindows(arrivedHead, rebasedAfterArrival)), ["x", "a", "b", "c", "d", "e", "f", "g", "h", "i"]);

// Après traitement de A, le listener remplit B-F et la page conservée devient
// G-J. Aucun A fantôme, aucun doublon et fin de file explicite (< pageSize).
const localAfterDone = initialHead.filter((item) => item.id !== "a");
const refilledHead = [action("b", 2), action("c", 3), action("d", 4), action("e", 5), action("f", 6)];
assert.deepEqual(ids(sandbox.displacedPersonalActionHead(localAfterDone, refilledHead)), []);
assert.deepEqual(ids(sandbox.mergePersonalActionWindows(refilledHead, [[action("g", 7), action("h", 8), action("i", 9), action("j", 10)]])), ["b", "c", "d", "e", "f", "g", "h", "i", "j"]);

// Un changement de priorité peut faire chevaucher tête et ancienne page. La
// donnée live doit gagner jusqu'au remplacement atomique de la page rebasée.
const staleA = action("a", 99, "ancien");
const freshA = action("a", 1, "actuel");
const deduped = sandbox.mergePersonalActionWindows([freshA], [[staleA, action("b", 2)]]);
assert.deepEqual(ids(deduped), ["a", "b"]);
assert.equal(deduped[0].title, "actuel");

// Si E perd sa priorité et F entre dans la tête, le chevauchement F est unique;
// la page rebasée G-J,E restaure ensuite l'ordre complet depuis le nouveau curseur F.
const priorityHead = [action("a", 1), action("b", 2), action("c", 3), action("d", 4), action("f", 6, "f-live")];
const priorityBoundary = sandbox.displacedPersonalActionHead(initialHead, priorityHead);
assert.deepEqual(ids(priorityBoundary), ["e"]);
const priorityRebased = [[action("g", 7), action("h", 8), action("i", 9), action("j", 10), action("e", 20, "e-repriorisé")]];
const priorityResult = sandbox.mergePersonalActionWindows(priorityHead, priorityRebased);
assert.deepEqual(ids(priorityResult), ["a", "b", "c", "d", "f", "g", "h", "i", "j", "e"]);
assert.equal(priorityResult.filter((item) => item.id === "f").length, 1);
assert.equal(priorityResult.at(-1).title, "e-repriorisé");
const stateMutation = client.slice(client.indexOf("export async function setPersonalActionItemState"), client.indexOf("export async function updateCockpitFeedbackStatus"));
assert.match(stateMutation, /runTransaction\(db, async \(transaction\)/);
assert.match(stateMutation, /transaction\.get\(reference\)/);
assert.equal((stateMutation.match(/transaction\.get\(/g) || []).length, 1, "Une bascule doit coûter exactement une lecture de document ciblée.");
assert.match(stateMutation, /queueKey: actionItemQueueKey/);
assert.doesNotMatch(stateMutation, /getDocs|onSnapshot|query\(/, "La bascule ne doit faire qu’une lecture ciblée, jamais relire la file.");
assert.match(subscription, /setLocalState\(actionItemId, nextState\)[\s\S]*retainedPages = retainedPages\.map/);
assert.match(actionUi, /cockpit:action-item-state-saved[\s\S]*setLocalState/);
assert.match(actionUi, /navigator\.setAppBadge\?\.\(1\)/, "Le badge PWA doit réutiliser la file déjà chargée sans nouvelle lecture.");
assert.match(actionUi, /navigator\.clearAppBadge/);
const mediaReady = buildTaskProgressPresentation(
  { stage:"content_approved" },
  { direction:{ status:"selected", mediaIds:["media-1"] }, agreement:{ status:"direction_only" } }
);
assert.equal(mediaReady.className, " workflow-ready");
assert.match(mediaReady.badge, /✓ Texte et visuel validés/);
assert.match(mediaReady.markup, /✓ Texte[\s\S]*✓ Visuel[\s\S]*>Terminé</);
const published = buildTaskProgressPresentation({ stage:"published" });
assert.equal(published.publication, true);
assert.match(published.badge, /✓ Terminé/);
const readyCard = renderActionTaskCard({
  task:{ id:"media-ready", targetType:"schedule", targetId:"event-1", title:"Choix média", message:"Programmer après les feux verts." },
  priorityLabel:"Prévu demain", estimate:10, when:"à l’instant", updatedAt:1,
  workflow:{ stage:"final_approved" }, mediaDecision:null
});
assert.match(readyCard, /cockpit-task-item workflow-ready/);
assert.match(readyCard, /aria-label="Avancement : texte approuvé; visuel approuvé; publication à terminer"/);
const commentCard = renderActionTaskCard({ task:{ id:"comment-1", targetType:"schedule", targetId:"event-1", title:"Consigne" }, priorityLabel:"Maintenant", estimate:5, when:"maintenant", updatedAt:1, workflow:{ stage:"published" } });
assert.doesNotMatch(commentCard, /workflow-ready|cockpit-task-progress/, "Une nouvelle consigne doit conserver son alerte même si le post est publié.");
const profileApplication = cockpitUi.slice(cockpitUi.indexOf("async function applyProfile"), cockpitUi.indexOf("function applySignedOut"));
assert.match(profileApplication, /if \(profile\.role === "admin"\) \{[\s\S]*buildAdminSidebar\(\)[\s\S]*buildTaskWidget\(\)[\s\S]*subscribeActionTasks\(renderActionTasks/,
  "Le panneau À accomplir et sa souscription doivent rester réservés à Valentin (rôle admin).");
assert.match(profileApplication, /\} else \{[\s\S]*document\.querySelector\("#cockpit-task-launch"\)\?\.remove\(\)/,
  "La vue de la direction doit retirer le lanceur À accomplir.");
assert.match(cockpitUi, /actionItem\?\.dataset\.actionItemId \|\| `media-direction-approval-\$\{card\.dataset\.itemId\}`/,
  "Le retrait d’un média doit retrouver l’action done par son identifiant déterministe et la remettre pending.");

assert.match(actionUi, /dataset\.error && activeProfile[\s\S]*setupPersonalActionItems\(activeProfile, true\)/, "Le réessai doit recréer le listener après une erreur.");
assert.match(view, /data-vm-media=/);
assert.match(view, /mediaId: target\.dataset\.vmMedia/);
assert.match(view, /cockpit:load-more-action-items/);
assert.match(view, /approve_text_then_media/);
assert.match(view, /estimatedDecisionMinutes/);
assert.match(view, /vm-time-estimate/);
assert.match(view, /\["final_approved", "scheduled", "published"\]/);

assert.match(rules, /match \/actionItems\/\{actionItemId\}/);
assert.match(rules, /resource\.data\.assigneeUid == request\.auth\.uid[\s\S]*resource\.data\.assigneeRole == userRole\(\)/);
assert.match(rules, /request\.query\.limit != null && request\.query\.limit > 0 && request\.query\.limit <= 25/);
assert.match(rules, /resource\.data\.queueKey >= personalPendingQueuePrefix\(\)[\s\S]*resource\.data\.queueKey < personalPendingQueuePrefix\(\) \+ '\\uf8ff'/);
assert.match(rules, /data\.queueKey == expectedActionQueueKey\(data, actionItemId\)/);
assert.match(rules, /actionItemId is string && actionItemId\.matches\('\^\[A-Za-z0-9_-\]\{3,180\}\$'\)/);
assert.match(rules, /request\.resource\.data\.state == 'pending'/);
assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['state', 'queueKey', 'updatedAt', 'updatedBy', 'lastMutationId'\]\)/);
assert.match(rules, /match \/actionItems\/[\s\S]*allow delete: if false;/);

const indexConfig = JSON.parse(indexes);
const actionIndex = indexConfig.indexes.find((item) => item.collectionGroup === "actionItems");
assert.equal(actionIndex, undefined, "queueKey doit utiliser l’index simple automatique; aucun composite actionItems n’est requis.");

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
assert.match(reconcile, /reconciledWorkflowStage/);
assert.match(reconcile, /state: \["agreed", "overridden"\]\.includes\(agreement\.status\) \? "done" : "pending"/);
assert.match(reconcile, /transaction\.set\(refs\.workflow, workflowAfter\)/);
assert.match(reconcile, /action\.queueKey = actionItemQueueKey\(action, ACTION_ID\)/);
assert.match(reconcile, /aq1\|\$\{value\.assigneeUid\.length\}/, "Le script Admin doit produire la même clé aq1 longueur-préfixée que le client et les règles.");

console.log("✓ Contrat actionItems : queueKey sans composite, plage personnelle, pagination, règles et réconciliation M0.");
