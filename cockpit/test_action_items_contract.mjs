import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { actionTaskShouldRemain, buildTaskProgressPresentation, renderActionTaskCard, visibleActionTaskTarget } from "./task-progress-ui.js";

const [client, cockpitUi, actionUi, view, rules, indexes, reconcile, contentNoticeSeed, feedbackProcessor, sectionFeedbackProcessor, notificationRecipient] = await Promise.all([
  readFile(new URL("./firebase-client.js", import.meta.url), "utf8"),
  readFile(new URL("./cockpit-ui.js", import.meta.url), "utf8"),
  readFile(new URL("./action-items-ui.js", import.meta.url), "utf8"),
  readFile(new URL("./view-mode.js", import.meta.url), "utf8"),
  readFile(new URL("./firestore.rules", import.meta.url), "utf8"),
  readFile(new URL("./firestore.indexes.json", import.meta.url), "utf8"),
  readFile(new URL("./reconcile_m0_libellule_action.js", import.meta.url), "utf8"),
  readFile(new URL("./seed_content_notices.js", import.meta.url), "utf8"),
  readFile(new URL("./process_feedback_action.js", import.meta.url), "utf8"),
  readFile(new URL("./process_section_feedback_action.js", import.meta.url), "utf8"),
  readFile(new URL("./notification-recipient.js", import.meta.url), "utf8")
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
assert.match(view, /globalThis\.navigator\?\.setAppBadge\?\.\(\)/, "Le badge PWA doit être un simple point sans nombre.");
assert.match(view, /globalThis\.navigator\?\.clearAppBadge/);
assert.match(view, /showNotification/, "Les alertes système doivent être dérivées de la file déjà rendue.");
assert.match(view, /data-vm-system-notification/, "L’autorisation des alertes système doit rester un choix explicite de l’utilisateur.");
assert.match(view, /aucune lecture Firebase ne sera ajoutée/i);
assert.doesNotMatch(view, /setAppBadge\?\.\(\s*\d+/, "L’indicateur ne doit jamais afficher un compteur.");
assert.match(view, /bleu-massawippi-attention-v1/);
assert.match(view, /notificationDecisionToken\(runtime\.identity, decision\)/);
assert.match(view, /markCurrentAttentionSeen/);
assert.match(view, /data-vm-attention-seen/);
assert.match(view, /attentionDwellMs/);
assert.doesNotMatch(actionUi, /setAppBadge|clearAppBadge/, "La file Firestore ne doit plus badger tous les éléments pending comme s’ils étaient nouveaux.");
assert.match(actionUi, /data-action-assignee-uid/, "Le destinataire exact doit être propagé jusqu’au modèle DOM local.");
assert.match(view, /notificationRecipientMatches\(identity, item\)/, "La vue doit revérifier le compte destinataire avant d’afficher ou de notifier.");
assert.match(view, /notificationOwnerKey\(runtime\.identity\)/, "La pagination locale doit être isolée par compte, pas seulement par rôle.");
assert.doesNotMatch(notificationRecipient, /firebase|onSnapshot|getDocs|fetch\(/i, "Le ciblage des notifications ne doit provoquer aucune lecture distante.");
assert.match(actionUi, /cockpit:content-notice-seen[\s\S]*setPersonalActionItemState\(actionItemId, "done", activeProfile\)/,
  "Une nouveauté réellement consultée doit utiliser la mutation personnelle ciblée existante.");
assert.match(actionUi, /item\.dataset\.actionType !== "content_notice"/,
  "Le client doit refuser de fermer un autre type de décision par l’événement de lecture.");
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
assert.equal(actionTaskShouldRemain({ id:"workflow-event-1", status:"pending", targetType:"schedule" }, { stage:"published" }), false,
  "Une ancienne tâche de cycle ne doit pas survivre à une publication terminée.");
assert.equal(actionTaskShouldRemain({ id:"comment-comment-1", status:"pending", targetType:"schedule" }, { stage:"published" }, [{ id:"comment-1", resolved:false }]), true,
  "Une nouvelle consigne explicite reste active tant qu'elle n'est pas traitée.");
assert.equal(actionTaskShouldRemain({ id:"comment-comment-1", status:"pending", targetType:"schedule" }, { stage:"published" }, [{ id:"comment-1", resolved:true }]), false,
  "Une consigne traitée disparaît de la file sans supprimer son historique.");
assert.equal(actionTaskShouldRemain({ id:"section-task", status:"pending", targetType:"section" }, { stage:"published" }), true,
  "La fin d'une publication ne doit jamais masquer une tâche de section indépendante.");
assert.equal(visibleActionTaskTarget("section", "cockpit"), "cockpit-feedback-list",
  "La boîte à idées générale doit ouvrir une cible réellement visible plutôt qu'un identifiant logique absent du DOM.");
assert.equal(visibleActionTaskTarget("schedule", "s4d1"), "s4d1",
  "Les destinations ordinaires doivent rester inchangées.");
assert.match(cockpitUi, /targetId: visibleActionTaskTarget\("section", sectionId\)/,
  "Les nouvelles rétroactions générales doivent enregistrer directement la destination visible.");
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
assert.match(view, /event\.media\.directionSelected\) return null/,
  "Une validation média de la direction doit élaguer sa propre décision sans nouvelle lecture.");
assert.match(view, /event\.media\.communicationsSelected && !event\.media\.directionSelected/,
  "Après recommandation des communications, la file doit transférer la prochaine action à la direction.");
assert.match(cockpitUi, /const requiredSelectionCount = allowsMultiple \? 2 : 1;[\s\S]*const resolved = selected && \(decision\?\.direction\?\.mediaIds\?\.length \|\| 0\) >= requiredSelectionCount;/,
  "Le choix complet de la direction doit fermer sa décision personnelle sans attendre un second clic des communications, y compris pour un carrousel à deux médias.");
assert.match(cockpitUi, /notifyViewUpdate\("task-completed"\)/,
  "Marquer complétée doit élaguer immédiatement les vues locales sans relecture supplémentaire.");
assert.match(client, /includeMetadataChanges: true/,
  "Le workflow persistant doit signaler le passage du cache au serveur même si les documents sont identiques.");
assert.match(cockpitUi, /document\.body\.dataset\.workflowSync = meta\.fromCache \? "cache" : "server"/,
  "La coque doit publier la fraîcheur du workflow pour les deux vues.");
assert.match(cockpitUi, /task\.targetType !== "schedule" \|\| current/,
  "À accomplir ne doit pas présenter une ancienne tâche de publication comme actuelle avant la confirmation serveur.");
assert.match(view, /const decisionsAreCurrent = workflowSync === "server"/,
  "Décisions qui m’attendent doit attendre la confirmation serveur au lieu de ressusciter le plan statique mobile.");
assert.match(view, /decision\.actionType === "content_notice"/);
assert.match(view, /isMeaningfullyVisible/);
assert.match(view, /cockpit:content-notice-seen/);
assert.match(view, /vm-decision-dock/);
assert.match(view, /decisionDockMinWidth/);
assert.match(contentNoticeSeed, /if \(existing\.exists\)[\s\S]*preserved \+= 1/,
  "Le semis versionné doit préserver une nouveauté déjà vue et ne jamais la rouvrir.");
assert.match(contentNoticeSeed, /actionType: "content_notice"/);
assert.match(contentNoticeSeed, /maximumReads/);

assert.match(feedbackProcessor, /--confirm-integrated/,
  "Le traitement d'une rétroaction doit exiger une confirmation explicite après son dry-run.");
assert.match(feedbackProcessor, /process-feedback-\$\{feedbackId\}/,
  "L'archive déterministe doit rendre le traitement idempotent.");
assert.match(feedbackProcessor, /if \(alreadyIntegrated\)[\s\S]*noOp: true/,
  "Une seconde exécution doit être une opération nulle.");
assert.match(feedbackProcessor, /feedback\.updateTime\.isEqual\(currentFeedback\.updateTime\)/,
  "Une rétroaction modifiée entre la lecture et l'écriture ne doit jamais être écrasée.");
assert.match(feedbackProcessor, /transaction\.update\(refs\.feedback, feedbackAfter\)[\s\S]*transaction\.update\(refs\.task, taskAfter\)[\s\S]*transaction\.set\(refs\.archive/,
  "La rétroaction, sa tâche et son archive doivent être réconciliées dans une seule transaction.");
assert.match(feedbackProcessor, /targetType: "schedule"|targetType,/,
  "La tâche traitée doit être reliée à la publication réellement créée.");
assert.match(sectionFeedbackProcessor, /--confirm-integrated/,
  "Une rétroaction de section doit exiger une confirmation explicite après son dry-run.");
assert.match(sectionFeedbackProcessor, /process-section-feedback-\$\{feedbackId\}/,
  "L’archive déterministe doit rendre la clôture de section idempotente.");
assert.match(sectionFeedbackProcessor, /source\.includes\(`id=/,
  "La section éditoriale doit exister localement avant de classer la rétroaction.");
assert.match(sectionFeedbackProcessor, /feedback\.updateTime\.isEqual\(currentFeedback\.updateTime\)/,
  "Une nouvelle intervention de la direction doit bloquer la transaction plutôt que d’être écrasée.");
assert.match(sectionFeedbackProcessor, /transaction\.update\(refs\.feedback, feedbackAfter\)[\s\S]*transaction\.set\(refs\.archive/,
  "La rétroaction et sa preuve d’archive doivent être écrites atomiquement.");
assert.doesNotMatch(sectionFeedbackProcessor, /delete\(/,
  "Le traitement éditorial ne doit supprimer aucune donnée.");

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

assert.match(cockpitUi, /mediaCommentButton\.closest\("\.cockpit-media-card"\)/,
  "Le commentaire média doit cibler la carte du visuel actionné, même dans un carrousel.");
assert.match(cockpitUi, /mediaCard\?\.querySelector\("input\[data-media-comment\]"\)/,
  "Le champ média ne doit pas dépendre de CSS.escape ni d’une recherche ambiguë dans tout l’événement.");
assert.doesNotMatch(cockpitUi, /CSS\.escape\(mediaId\)/,
  "L’enregistrement d’un commentaire média doit rester compatible sans dépendance CSS.escape.");
assert.match(cockpitUi, /Le commentaire média est enregistré; la tâche de suivi sera réconciliée au prochain cycle\./,
  "Un commentaire déjà enregistré ne doit pas être resoumis si la seule tâche de suivi échoue.");

console.log("✓ Contrat actionItems : queueKey sans composite, plage personnelle, pagination, règles et réconciliation M0.");
