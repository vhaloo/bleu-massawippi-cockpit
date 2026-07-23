import assert from "node:assert/strict";
import {
  notificationDecisionToken,
  notificationOwnerKey,
  notificationRecipientMatches,
  notificationSystemTag
} from "./notification-recipient.js";

const annie = { uid: "uid-annie", role: "director" };
const directionColleague = { uid: "uid-direction-2", role: "director" };
const valentin = { uid: "uid-valentin", role: "admin" };
const communicationsColleague = { uid: "uid-communications-2", role: "admin" };

assert.equal(notificationRecipientMatches(annie, { assigneeUid:annie.uid, assigneeRole:"director" }), true);
assert.equal(notificationRecipientMatches(directionColleague, { assigneeUid:annie.uid, assigneeRole:"director" }), false,
  "Deux comptes du même rôle ne doivent jamais partager une notification nominative.");
assert.equal(notificationRecipientMatches(valentin, { assigneeUid:annie.uid, assigneeRole:"director" }), false);

assert.equal(notificationRecipientMatches(valentin, { assigneeRole:"admin" }), true,
  "Une attribution au rôle seul demeure une notification d’équipe explicite.");
assert.equal(notificationRecipientMatches(communicationsColleague, { assigneeRole:"admin" }), true);
assert.equal(notificationRecipientMatches(annie, { assigneeRole:"admin" }), false);

assert.notEqual(notificationOwnerKey(annie), notificationOwnerKey(directionColleague),
  "L’état vu doit être séparé pour deux comptes ayant le même rôle.");

const decision = {
  actionItemId:"decision-1",
  targetType:"schedule",
  targetId:"post-1",
  action:"Valider le texte",
  whyNow:"Texte prêt",
  updatedAt:123
};
assert.notEqual(notificationDecisionToken(annie, decision), notificationDecisionToken(directionColleague, decision),
  "Un même élément ne doit pas partager son jeton de lecture entre deux utilisateurs.");
assert.notEqual(notificationSystemTag(annie), notificationSystemTag(directionColleague),
  "Les notifications du système d’exploitation doivent être isolées par compte.");
assert.doesNotMatch(notificationSystemTag(annie), /uid-annie/,
  "Le tag système ne doit pas exposer l’identifiant du compte.");

console.log("Notification recipient checks: exact account, role fallback, isolated seen state and OS tags passed.");
