/**
 * Ciblage local des notifications du cockpit.
 *
 * Une attribution à un UID est toujours personnelle et prioritaire. Une
 * attribution qui ne contient qu'un rôle demeure un repli d'équipe explicite.
 * Ce module ne lit ni n'écrit aucune donnée distante.
 */

const clean = (value) => String(value || "").trim();

export function notificationOwnerKey(identity = {}) {
  const uid = clean(identity.uid);
  const role = clean(identity.role).toLowerCase();
  if (uid) return `uid:${uid}`;
  if (role) return `role:${role}`;
  return "device";
}

export function notificationRecipientMatches(identity = {}, recipient = {}) {
  const identityUid = clean(identity.uid);
  const identityRole = clean(identity.role).toLowerCase();
  const assigneeUid = clean(recipient.assigneeUid);
  const assigneeRole = clean(recipient.assigneeRole || recipient.audienceRole).toLowerCase();

  // Dès qu'un compte précis est nommé, un collègue ayant le même rôle ne doit
  // jamais recevoir l'élément à sa place.
  if (assigneeUid) {
    return Boolean(identityUid && identityUid === assigneeUid
      && (!assigneeRole || identityRole === assigneeRole));
  }

  // Le rôle seul représente volontairement une tâche d'équipe.
  return Boolean(assigneeRole && identityRole === assigneeRole);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function notificationDecisionToken(identity = {}, decision = {}) {
  const owner = clean(decision.actionItemId || decision.taskId)
    || `${clean(decision.targetType || "schedule")}:${clean(decision.targetId || decision.id)}`;
  const version = Number(decision.updatedAt || 0);
  const meaning = stableHash([
    decision.action || "",
    decision.whyNow || "",
    decision.mediaId || "",
    decision.stage || "",
    decision.date?.toISOString?.() || ""
  ].join("|"));
  return `${notificationOwnerKey(identity)}:${owner}:${version}:${meaning}`;
}

export function notificationSystemTag(identity = {}, kind = "attention") {
  // Le tag ne révèle pas l'UID dans les surfaces du système d'exploitation.
  return `cockpit-${clean(kind) || "attention"}-${stableHash(notificationOwnerKey(identity))}`;
}
