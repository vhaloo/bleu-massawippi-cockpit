import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  runTransaction,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
const config = globalThis.COCKPIT_FIREBASE_CONFIG || {};
const required = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
const roles = new Set(["director", "admin", "viewer"]);
const configured = required.every((key) => {
  const value = config[key];
  return typeof value === "string" && value.length > 0 && !value.includes("REMPLACER");
});

let app;
let auth;
let db;
let persistenceState = "not-configured";
const REQUEST_TIMEOUT_MS = 15000;

function withTimeout(promise, message, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

if (configured) {
  app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
  try {
    const offlineRequested = typeof location !== "undefined" && new URLSearchParams(location.search).get("offline") === "1";
    if (offlineRequested) {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
      persistenceState = "enabled";
    } else {
      // Le mode mémoire évite le verrou exclusif IndexedDB lorsque plusieurs
      // onglets du cockpit sont ouverts. L’authentification reste persistante;
      // seules les données Firestore sont relues du serveur à chaque onglet.
      db = initializeFirestore(app, { localCache: memoryLocalCache() });
      persistenceState = "memory";
    }
  } catch {
    db = getFirestore(app);
    persistenceState = "unavailable";
  }
  setPersistence(auth, browserLocalPersistence).catch(() => {
    persistenceState = "unavailable";
  });
}

function requireConfigured() {
  if (!configured) {
    throw new Error("Firebase n’est pas configuré. Renseignez firebase-config.js.");
  }
}

async function appendChangeArchive(entityType, entityId, action, before, after, profile) {
  if (!profile || !["director", "admin"].includes(profile.role)) return;
  const compact = (value) => {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 5000) : item]));
  };
  try {
    await addDoc(collection(db, "changeArchive"), {
      entityType: String(entityType || "unknown").slice(0, 80),
      entityId: String(entityId || "unknown").slice(0, 160),
      action: String(action || "modification").slice(0, 160),
      before: compact(before),
      after: compact(after),
      actorUid: profile.uid,
      actorLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Archive de changement non écrite", error);
  }
}

async function getProfile(user) {
  if (!user) return null;
  const fallback = {
    uid: user.uid,
    role: "viewer",
    displayLabel: user.displayName || user.email || "Utilisateur",
    active: false
  };
  if (!db) return fallback;
  try {
    const snapshot = await withTimeout(getDoc(doc(db, "users", user.uid)), "Le profil Firebase ne répond pas.");
    if (!snapshot.exists()) return fallback;
    const profile = { ...fallback, ...snapshot.data(), uid: user.uid };
    return {
      ...profile,
      role: roles.has(profile.role) ? profile.role : "viewer",
      active: profile.active === true,
      displayLabel: String(profile.displayLabel || fallback.displayLabel).slice(0, 120)
    };
  } catch (error) {
    console.warn("Profil Firebase indisponible", error);
    throw error;
  }
}

export function getClientState() {
  return { configured, persistenceState, auth, db };
}

export async function fetchPrivateContent() {
  requireConfigured();
  const snapshot = await withTimeout(getDoc(doc(db, "privateContent", "plan")), "Le contenu sécurisé ne répond pas après 15 secondes. Réessayez.");
  if (!snapshot.exists()) {
    throw new Error("Le contenu sécurisé n’a pas encore été préparé.");
  }
  const data = snapshot.data();
  if (typeof data.html !== "string" || typeof data.css !== "string" || typeof data.script !== "string") {
    throw new Error("Le contenu sécurisé est incomplet.");
  }
  return data;
}

export async function fetchMediaConfig() {
  requireConfigured();
  const snapshot = await withTimeout(getDoc(doc(db, "privateConfig", "media")), "La configuration OneDrive ne répond pas.");
  if (!snapshot.exists()) return { folderUrl: "", folderViewUrl: "" };
  const data = snapshot.data();
  return {
    folderUrl: String(data.folderUrl || "").slice(0, 2048),
    folderViewUrl: String(data.folderViewUrl || "").slice(0, 2048),
    logoUrl: String(data.logoUrl || "").slice(0, 2048)
  };
}

export function observeAuth(callback) {
  if (!configured) {
    callback(null, null, new Error("Firebase non configuré."));
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback(null, null, null);
      return;
    }
    getProfile(user)
      .then((profile) => callback(user, profile, null))
      .catch((error) => callback(user, null, error));
  });
}

export async function signIn(email, password) {
  requireConfigured();
  const credential = await withTimeout(signInWithEmailAndPassword(auth, email, password), "Le service de connexion ne répond pas après 15 secondes. Vérifiez votre réseau puis réessayez.");
  return credential.user;
}

export async function sendPasswordReset(email) {
  requireConfigured();
  auth.languageCode = "fr-CA";
  return sendPasswordResetEmail(auth, email);
}

export async function logOut() {
  requireConfigured();
  return signOut(auth);
}

export function subscribeScheduleItems(callback, onError) {
  requireConfigured();
  const unsubscribe = onSnapshot(
    collection(db, "scheduleItems"),
    (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => String(a.dateIso || a.dateKey || "").localeCompare(String(b.dateIso || b.dateKey || "")));
      callback(rows);
    },
    onError
  );
  return unsubscribe;
}

export async function updateScheduleItem(itemId, changes, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit de modifier le calendrier.");
  }
  await updateDoc(doc(db, "scheduleItems", itemId), {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  });
}

export async function upsertScheduleItem(itemId, payload, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit de modifier le calendrier.");
  }
  if (!String(itemId || "").match(/^[a-z0-9-]{3,80}$/i)) {
    throw new Error("Identifiant de publication invalide.");
  }
  if (!["approved", "needs_work", "pending", "deleted"].includes(payload.status)) {
    throw new Error("Statut de publication invalide.");
  }
  const reference = doc(db, "scheduleItems", itemId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  const after = { ...before, ...payload, deleted: payload.status === "deleted" };
  await setDoc(reference, {
    ...payload,
    deleted: payload.status === "deleted",
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  }, { merge: true });
  await appendChangeArchive("scheduleItem", itemId, "calendrier : " + payload.status, {
    title: before.title || "",
    dateKey: before.dateKey || "",
    status: before.status || "pending",
    deleted: before.deleted === true,
    selected: before.selected === true
  }, {
    title: after.title || "",
    dateKey: after.dateKey || "",
    status: after.status || "pending",
    deleted: after.deleted === true,
    selected: after.selected === true
  }, profile);
}

export async function setScheduleSelection(itemId, groupIds, selected, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’arbitrer le calendrier.");
  }
  const ids = [...new Set([itemId, ...(Array.isArray(groupIds) ? groupIds : [])])]
    .filter((id) => /^[a-z0-9-]{3,80}$/i.test(String(id)));
  if (!ids.includes(itemId)) throw new Error("Groupe de choix invalide.");
  const beforeDocs = await Promise.all(ids.map((id) => getDoc(doc(db, "scheduleItems", id))));
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, "scheduleItems", id), {
      selected: Boolean(selected) && id === itemId,
      updatedAt: serverTimestamp(),
      updatedBy: profile.uid
    });
  }
  await batch.commit();
  await Promise.all(ids.map((id, index) => {
    const before = beforeDocs[index].exists() ? beforeDocs[index].data() : {};
    return appendChangeArchive("scheduleItem", id, "choix éditorial : " + (selected && id === itemId ? "sélectionné" : "désélectionné"), {
      title: before.title || "",
      dateKey: before.dateKey || "",
      status: before.status || "pending",
      deleted: before.deleted === true,
      selected: before.selected === true
    }, {
      title: before.title || "",
      dateKey: before.dateKey || "",
      status: before.status || "pending",
      deleted: before.deleted === true,
      selected: Boolean(selected) && id === itemId
    }, profile);
  }));
}

export async function addComment(itemId, comment, profile, quickTag = null, dictated = false) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’ajouter un commentaire.");
  }
  const text = String(comment || "").trim();
  if (!text) return;
  const now = serverTimestamp();
  const reference = await addDoc(collection(db, "comments"), {
    sectionId: itemId,
    comment: text.slice(0, 5000),
    quickTag,
    dictated: Boolean(dictated),
    authorUid: profile.uid,
    authorLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    deleted: false,
    resolved: false,
    resolvedAt: null,
    resolvedBy: "",
    resolvedByLabel: "",
    createdAt: now,
    updatedAt: now,
    updatedBy: profile.uid
  });
  await appendChangeArchive("comment", reference.id, dictated ? "commentaire dicté" : "commentaire ajouté", {}, {
    sectionId: itemId,
    comment: text,
    quickTag: quickTag || null,
    dictated: Boolean(dictated)
  }, profile);
  return reference.id;
}

export function subscribeComments(callback, onError) {
  requireConfigured();
  const commentsQuery = query(collection(db, "comments"), orderBy("createdAt", "asc"), limit(500));
  return onSnapshot(commentsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function updateOwnComment(commentId, text, profile) {
  requireConfigured();
  const reference = doc(db, "comments", commentId);
  const existing = await getDoc(reference);
  if (!existing.exists() || existing.data().authorUid !== profile?.uid) throw new Error("Vous pouvez modifier uniquement votre propre commentaire.");
  const comment = String(text || "").trim().slice(0, 5000);
  if (!comment) throw new Error("Le commentaire ne peut pas être vide.");
  await updateDoc(reference, { comment, updatedAt: serverTimestamp(), updatedBy: profile.uid });
  await appendChangeArchive("comment", commentId, "commentaire modifié", { comment: existing.data().comment || "" }, { comment }, profile);
}

export async function archiveOwnComment(commentId, profile) {
  requireConfigured();
  const reference = doc(db, "comments", commentId);
  const existing = await getDoc(reference);
  if (!existing.exists() || existing.data().authorUid !== profile?.uid) throw new Error("Vous pouvez archiver uniquement votre propre commentaire.");
  await updateDoc(reference, { deleted: true, updatedAt: serverTimestamp(), updatedBy: profile.uid });
  await appendChangeArchive("comment", commentId, "commentaire archivé", { deleted: false, comment: existing.data().comment || "" }, { deleted: true, comment: existing.data().comment || "" }, profile);
}

export async function resolveComment(commentId, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas traiter ce commentaire.");
  const reference = doc(db, "comments", commentId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Ce commentaire n’existe plus.");
  const before = existing.data();
  await updateDoc(reference, {
    resolved: true,
    resolvedAt: serverTimestamp(),
    resolvedBy: profile.uid,
    resolvedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  });
  await appendChangeArchive("comment", commentId, "commentaire traité", {
    resolved: before.resolved === true,
    comment: before.comment || ""
  }, {
    resolved: true,
    comment: before.comment || ""
  }, profile);
}

const workflowStages = new Set(["proposal", "content_review", "changes_requested", "content_changes_requested", "content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);
const contentApprovedWorkflowStages = new Set(["content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);

export async function setWorkflowStage(eventId, stage, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas modifier le cycle de validation.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(eventId || "")) || !workflowStages.has(stage)) throw new Error("Étape de validation invalide.");
  const reference = doc(db, "workflowStates", eventId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  if ((["scheduled", "published"].includes(stage) || ["scheduled", "published"].includes(before.stage)) && profile.role !== "admin") {
    throw new Error("Seules les communications peuvent terminer, rouvrir ou confirmer une publication programmée ou publiée.");
  }
  if (stage === "final_approved" && !(profile.role === "admin" && ["scheduled", "published"].includes(before.stage))) {
    throw new Error("Choisissez et approuvez le média dans la galerie; la porte visuelle sera alors signée automatiquement.");
  }
  if (["scheduled", "published"].includes(stage) && !["final_approved", "scheduled", "published"].includes(before.stage)) {
    throw new Error("Le texte et le média doivent être approuvés avant de terminer la publication.");
  }
  await setDoc(reference, {
    eventId,
    stage,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    updatedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120)
  }, { merge: true });
  await appendChangeArchive("workflowState", eventId, "cycle : " + stage, { stage: before.stage || "proposal" }, { stage }, profile);
}

export function subscribeWorkflowStates(callback, onError) {
  requireConfigured();
  return onSnapshot(collection(db, "workflowStates"), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

const opportunityStages = new Set(["watch", "research", "active", "submitted", "completed"]);

export async function setOpportunityStage(opportunityId, stage, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas modifier le suivi des occasions.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(opportunityId || "")) || !opportunityStages.has(stage)) throw new Error("Étape de projet invalide.");
  const reference = doc(db, "opportunityStates", opportunityId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  await setDoc(reference, {
    opportunityId,
    stage,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    updatedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120)
  }, { merge: true });
  await appendChangeArchive("opportunityState", opportunityId, "occasion : " + stage, { stage: before.stage || "watch" }, { stage }, profile);
}

export function subscribeOpportunityStates(callback, onError) {
  requireConfigured();
  return onSnapshot(collection(db, "opportunityStates"), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

const internalProjectStages = new Set(["to_frame", "planned", "active", "blocked", "completed"]);

export async function setInternalProjectStage(projectId, stage, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas modifier le suivi des projets internes.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(projectId || "")) || !internalProjectStages.has(stage)) throw new Error("Étape de projet interne invalide.");
  const reference = doc(db, "internalProjectStates", projectId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  await setDoc(reference, {
    projectId,
    stage,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    updatedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120)
  }, { merge: true });
  await appendChangeArchive("internalProjectState", projectId, "projet interne : " + stage, { stage: before.stage || "to_frame" }, { stage }, profile);
}

export function subscribeInternalProjectStates(callback, onError) {
  requireConfigured();
  const statesQuery = query(collection(db, "internalProjectStates"), limit(100));
  return onSnapshot(statesQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

const editorialDecisionValues = new Set(["undecided", "chosen", "deferred", "rejected"]);

export async function setEditorialDecision(eventId, decision, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas arbitrer cette proposition.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(eventId || "")) || !editorialDecisionValues.has(decision)) throw new Error("Décision éditoriale invalide.");
  const reference = doc(db, "editorialDecisions", eventId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  await setDoc(reference, {
    eventId,
    decision,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    updatedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120)
  }, { merge: true });
  await appendChangeArchive("editorialDecision", eventId, "arbitrage : " + decision, { decision: before.decision || "undecided" }, { decision }, profile);
}

export function subscribeEditorialDecisions(callback, onError) {
  requireConfigured();
  return onSnapshot(collection(db, "editorialDecisions"), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

function normalizeMediaUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error("Le lien média n’est pas valide.");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = parsed.protocol === "https:" && (host.endsWith(".sharepoint.com") || host === "1drv.ms" || host === "onedrive.live.com");
  if (!allowed) throw new Error("Utilisez un lien HTTPS OneDrive ou SharePoint.");
  return parsed.href.slice(0, 2048);
}

export async function addMediaLink(eventId, payload, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’ajouter un média.");
  }
  if (!/^[a-z0-9-]{3,80}$/i.test(String(eventId || ""))) throw new Error("Événement média invalide.");
  const kinds = new Set(["image", "video", "pdf", "document", "folder", "other"]);
  // `proposal` décrit une proposition à examiner. Il ne constitue jamais une
  // approbation et doit rester distinct de `approved` dans le modèle comme
  // dans les règles Firestore.
  const stages = new Set(["source", "proposal", "draft", "approved", "published", "reference"]);
  const kind = kinds.has(payload.kind) ? payload.kind : "other";
  const stage = stages.has(payload.stage) ? payload.stage : "reference";
  const now = serverTimestamp();
  const data = {
    eventId,
    label: String(payload.label || "Média OneDrive").trim().slice(0, 180),
    url: normalizeMediaUrl(payload.url),
    kind,
    stage,
    note: String(payload.note || "").trim().slice(0, 1000),
    archived: false,
    authorUid: profile.uid,
    authorLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    createdAt: now,
    updatedAt: now,
    updatedBy: profile.uid
  };
  const reference = await addDoc(collection(db, "mediaLinks"), data);
  await appendChangeArchive("mediaLink", reference.id, "lien média ajouté", {}, {
    eventId, label: data.label, url: data.url, kind, stage, note: data.note, archived: false
  }, profile);
  return reference.id;
}

export async function archiveMediaLink(mediaId, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’archiver un média.");
  }
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(mediaId || ""))) throw new Error("Média invalide.");
  const reference = doc(db, "mediaLinks", mediaId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Ce média n’existe plus.");
  await updateDoc(reference, { archived: true, updatedAt: serverTimestamp(), updatedBy: profile.uid });
  const before = existing.data();
  await appendChangeArchive("mediaLink", mediaId, "lien média archivé", {
    eventId: before.eventId || "", label: before.label || "", url: before.url || "", kind: before.kind || "other", stage: before.stage || "reference", note: before.note || "", archived: false
  }, {
    eventId: before.eventId || "", label: before.label || "", url: before.url || "", kind: before.kind || "other", stage: before.stage || "reference", note: before.note || "", archived: true
  }, profile);
}

const emptyDecisionSide = (actorRole) => ({
  status: "none",
  mediaIds: [],
  actorUid: "",
  actorLabel: "",
  actorRole,
  decidedAt: null
});

const emptyOverride = () => ({
  active: false,
  mediaIds: [],
  reason: "",
  actorUid: "",
  actorLabel: "",
  actorRole: "",
  decidedAt: null
});

function normalizedDecisionSide(value, actorRole) {
  if (!value || typeof value !== "object") return emptyDecisionSide(actorRole);
  const mediaIds = Array.isArray(value.mediaIds)
    ? [...new Set(value.mediaIds.map((item) => String(item || "")).filter((item) => /^[A-Za-z0-9_-]{3,160}$/.test(item)))].slice(0, 8)
    : [];
  const status = value.status === "selected" && mediaIds.length ? "selected" : value.status === "revoked" ? "revoked" : "none";
  return {
    status,
    mediaIds: status === "selected" ? mediaIds : [],
    actorUid: String(value.actorUid || ""),
    actorLabel: String(value.actorLabel || "").slice(0, 120),
    actorRole,
    decidedAt: value.decidedAt || null
  };
}

function normalizedOverride(value) {
  if (!value || typeof value !== "object" || value.active !== true) return emptyOverride();
  const mediaIds = Array.isArray(value.mediaIds)
    ? [...new Set(value.mediaIds.map((item) => String(item || "")).filter((item) => /^[A-Za-z0-9_-]{3,160}$/.test(item)))].slice(0, 8)
    : [];
  if (!mediaIds.length) return emptyOverride();
  return {
    active: true,
    mediaIds,
    reason: String(value.reason || "").slice(0, 500),
    actorUid: String(value.actorUid || ""),
    actorLabel: String(value.actorLabel || "").slice(0, 120),
    actorRole: value.actorRole === "director" ? "director" : "admin",
    decidedAt: value.decidedAt || null
  };
}

function sameOrderedMedia(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

// Fonction pure exportée afin que le contrat de décision puisse être testé
// sans connexion Firebase. L'état dérivé ne remplace jamais les deux choix.
export function deriveMediaAgreement(communications, direction, override, textApproved) {
  const communicationsIds = communications?.status === "selected" && Array.isArray(communications.mediaIds) ? communications.mediaIds : [];
  const directionIds = direction?.status === "selected" && Array.isArray(direction.mediaIds) ? direction.mediaIds : [];
  const overrideIds = override?.active === true && Array.isArray(override.mediaIds) ? override.mediaIds : [];
  if (textApproved && overrideIds.length && String(override.reason || "").trim()) {
    return { status: "overridden", mediaIds: [...overrideIds], divergent: false };
  }
  if (communicationsIds.length && directionIds.length) {
    if (textApproved && sameOrderedMedia(communicationsIds, directionIds)) {
      return { status: "agreed", mediaIds: [...communicationsIds], divergent: false };
    }
    if (!sameOrderedMedia(communicationsIds, directionIds)) {
      return { status: "divergent", mediaIds: [], divergent: true };
    }
  }
  return { status: "pending", mediaIds: [], divergent: false };
}

function normalizeMediaDecision(value, eventId) {
  const communications = normalizedDecisionSide(value?.communications, "admin");
  const direction = normalizedDecisionSide(value?.direction, "director");
  const override = normalizedOverride(value?.override);
  const textApproved = contentApprovedWorkflowStages.has(String(value?.textGateStage || ""));
  const agreement = deriveMediaAgreement(communications, direction, override, textApproved);
  return {
    eventId,
    schemaVersion: 2,
    communications,
    direction,
    override,
    agreement: {
      status: ["pending", "agreed", "divergent", "overridden"].includes(value?.agreement?.status) ? value.agreement.status : agreement.status,
      mediaIds: Array.isArray(value?.agreement?.mediaIds) ? value.agreement.mediaIds.slice(0, 8) : agreement.mediaIds,
      divergent: value?.agreement?.divergent === true
    },
    textGateStage: String(value?.textGateStage || "proposal"),
    lastMutationId: String(value?.lastMutationId || ""),
    updatedAt: value?.updatedAt || null,
    updatedBy: String(value?.updatedBy || ""),
    updatedByLabel: String(value?.updatedByLabel || "").slice(0, 120)
  };
}

function mediaDecisionArchiveView(value) {
  return {
    communications: value.communications,
    direction: value.direction,
    override: value.override,
    agreement: value.agreement,
    textGateStage: value.textGateStage || "proposal",
    lastMutationId: value.lastMutationId || ""
  };
}

export async function setMediaDecision(eventId, mediaId, selected, profile, options = {}) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas choisir ce média.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(eventId || ""))) throw new Error("Événement média invalide.");
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(mediaId || ""))) throw new Error("Média invalide.");

  const mediaReference = doc(db, "mediaLinks", mediaId);
  const decisionReference = doc(db, "mediaDecisions", eventId);
  const workflowReference = doc(db, "workflowStates", eventId);
  const wantsOverride = options.override === true;
  const overrideReason = String(options.reason || "").trim().slice(0, 500);
  if (wantsOverride && profile.role !== "director") {
    throw new Error("L’override des communications exige une preuve d’aval structurée et n’est pas offert dans cette version. La direction peut retenir explicitement son choix.");
  }
  const actorLabel = String(profile.displayLabel || "Utilisateur").slice(0, 120);
  const sideName = profile.role === "admin" ? "communications" : "direction";
  const mutationId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const archiveReference = doc(db, "changeArchive", `media-${mutationId}`.slice(0, 160));

  return runTransaction(db, async (transaction) => {
    const [mediaSnapshot, decisionSnapshot, workflowSnapshot] = await Promise.all([
      transaction.get(mediaReference),
      transaction.get(decisionReference),
      transaction.get(workflowReference)
    ]);
    if (!mediaSnapshot.exists() || mediaSnapshot.data().eventId !== eventId) throw new Error("Ce média n’appartient pas à cet événement.");
    const media = mediaSnapshot.data();
    if (selected && (media.publicationBlocked === true || media.archived === true)) {
      throw new Error("Cette référence est conservée pour comparaison et ne peut pas être choisie.");
    }

    const workflowBefore = workflowSnapshot.exists() ? workflowSnapshot.data() : { eventId, stage: "proposal" };
    const workflowStage = String(workflowBefore.stage || "proposal");
    const textApproved = contentApprovedWorkflowStages.has(workflowStage);
    if (profile.role === "director" && selected && !textApproved) {
      throw new Error("Le texte doit être approuvé avant que la direction puisse approuver le visuel.");
    }
    if (wantsOverride && (!selected || !textApproved || !overrideReason)) {
      throw new Error("Un override exige le texte approuvé, un média choisi et un motif explicite.");
    }

    const before = normalizeMediaDecision(decisionSnapshot.exists() ? decisionSnapshot.data() : {}, eventId);
    const sameExistingChoice = before[sideName].status === (selected ? "selected" : "revoked")
      && (selected ? before[sideName].mediaIds.length === 1 && before[sideName].mediaIds[0] === mediaId : before[sideName].mediaIds.length === 0)
      && !wantsOverride
      && (profile.role === "admin" || before.override.active !== true);
    if (sameExistingChoice) return before;

    const now = serverTimestamp();
    const next = {
      ...before,
      communications: { ...before.communications },
      direction: { ...before.direction },
      // Une action des communications ne peut jamais révoquer implicitement
      // une décision motivée de la direction. Seule la direction peut la
      // remplacer ou la retirer; les règles Firestore imposent la même limite.
      override: profile.role === "admin"
        ? { ...before.override, mediaIds: [...before.override.mediaIds] }
        : emptyOverride(),
      textGateStage: workflowStage
    };
    next[sideName] = {
      status: selected ? "selected" : "revoked",
      mediaIds: selected ? [mediaId] : [],
      actorUid: profile.uid,
      actorLabel,
      actorRole: profile.role,
      decidedAt: now
    };
    if (wantsOverride) {
      next.override = {
        active: true,
        mediaIds: [mediaId],
        reason: overrideReason,
        actorUid: profile.uid,
        actorLabel,
        actorRole: profile.role,
        decidedAt: now
      };
    }
    const agreement = deriveMediaAgreement(next.communications, next.direction, next.override, textApproved);
    next.agreement = agreement;
    next.lastMutationId = mutationId;
    next.updatedAt = now;
    next.updatedBy = profile.uid;
    next.updatedByLabel = actorLabel;

    let nextWorkflowStage = workflowStage;
    if (["agreed", "overridden"].includes(agreement.status) && !["final_approved", "scheduled", "published"].includes(workflowStage)) {
      nextWorkflowStage = "final_approved";
    } else if (!["agreed", "overridden"].includes(agreement.status) && workflowStage === "final_approved") {
      nextWorkflowStage = "media_review";
    } else if (!["agreed", "overridden"].includes(agreement.status) && ["scheduled", "published"].includes(workflowStage)) {
      if (profile.role !== "admin") {
        throw new Error("Après programmation ou publication, les communications doivent rouvrir le visuel afin de préserver l’historique public.");
      }
      nextWorkflowStage = "media_changes_requested";
    }

    transaction.set(decisionReference, next);
    if (!workflowSnapshot.exists() || nextWorkflowStage !== workflowStage) {
      transaction.set(workflowReference, {
        eventId,
        stage: nextWorkflowStage,
        updatedAt: now,
        updatedBy: profile.uid,
        updatedByLabel: actorLabel
      });
    }
    transaction.set(archiveReference, {
      entityType: "mediaDecision",
      entityId: eventId,
      action: selected ? (wantsOverride ? "choix média confirmé par la direction" : `${sideName} : média choisi`) : `${sideName} : choix média retiré`,
      before: mediaDecisionArchiveView(before),
      after: mediaDecisionArchiveView(next),
      actorUid: profile.uid,
      actorLabel,
      createdAt: now
    });
    return next;
  });
}

export function subscribeMediaDecisions(callback, onError) {
  requireConfigured();
  // Fenêtre M0 bornée et transitoire : un seul listener de résumés, jamais un
  // listener par carte. La projection par fenêtre de dates remplacera ce
  // plafond après validation de parité.
  const decisionsQuery = query(collection(db, "mediaDecisions"), orderBy("updatedAt", "desc"), limit(80));
  return onSnapshot(
    decisionsQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

// Compatibilité ascendante : les anciens clients peuvent encore écrire le
// marqueur global. Les nouveaux lecteurs le montrent comme héritage non
// attribué seulement lorsqu'aucune décision structurée n'existe.
export async function setMediaFinalChoice(mediaId, selected, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas retenir le média final.");
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(mediaId || ""))) throw new Error("Média invalide.");
  const reference = doc(db, "mediaLinks", mediaId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Ce média n’existe plus.");
  const before = existing.data();
  if (selected && (before.publicationBlocked === true || before.archived === true)) {
    throw new Error("Cette référence est conservée pour comparaison et ne peut pas devenir le média final.");
  }
  const next = {
    selectedFinal: Boolean(selected),
    approvedAt: selected ? serverTimestamp() : null,
    approvedBy: selected ? profile.uid : "",
    approvedByLabel: selected ? String(profile.displayLabel || "Direction").slice(0, 120) : "",
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  };
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, next);
  batch.set(archiveReference, {
    entityType: "mediaLink",
    entityId: mediaId,
    action: selected ? "média final retenu" : "média retiré du choix final",
    before: { selectedFinal: before.selectedFinal === true },
    after: { selectedFinal: Boolean(selected) },
    actorUid: profile.uid,
    actorLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

export function subscribeMediaLinks(callback, onError) {
  requireConfigured();
  const mediaQuery = query(collection(db, "mediaLinks"), orderBy("createdAt", "desc"), limit(500));
  return onSnapshot(
    mediaQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function writeAuditLog(sectionId, action, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) return;
  await addDoc(collection(db, "auditLogs"), {
    sectionId: String(sectionId || "").slice(0, 120),
    action: String(action || "modification").slice(0, 120),
    userUid: profile.uid,
    userLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    createdAt: serverTimestamp()
  });
}

export async function addCockpitFeedback(sectionId, message, category, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’envoyer une rétroaction.");
  }
  const text = String(message || "").trim();
  if (!text) return;
  const now = serverTimestamp();
  const reference = await addDoc(collection(db, "cockpitFeedback"), {
    sectionId: String(sectionId || "cockpit").slice(0, 120),
    message: text.slice(0, 5000),
    category: String(category || "recommandation").slice(0, 80),
    page: location.pathname.slice(0, 240),
    authorUid: profile.uid,
    authorLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    status: "open",
    createdAt: now,
    updatedAt: now,
    updatedBy: profile.uid
  });
  await appendChangeArchive("cockpitFeedback", reference.id, "rétroaction déposée", {}, {
    sectionId,
    message: text,
    category: String(category || "recommandation")
  }, profile);
  return reference.id;
}

export async function upsertActionTask(taskId, payload, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit de signaler une tâche.");
  }
  if (!/^[a-z0-9-]{3,160}$/i.test(String(taskId || ""))) throw new Error("Identifiant de tâche invalide.");
  const status = payload.status === "done" ? "done" : "pending";
  const reference = doc(db, "tasks", taskId);
  let existing = { exists: () => false };
  try {
    existing = await getDoc(reference);
  } catch (error) {
    if (error?.code !== "permission-denied") throw error;
  }
  const before = existing.exists() ? existing.data() : {};
  const after = {
    ...before,
    ...payload,
    status,
    title: String(payload.title || "Tâche à traiter").slice(0, 220),
    targetType: payload.targetType === "section" ? "section" : "schedule",
    targetId: String(payload.targetId || "").slice(0, 160),
    targetLabel: String(payload.targetLabel || "").slice(0, 220)
  };
  await setDoc(reference, {
    title: String(payload.title || "Tâche à traiter").slice(0, 220),
    message: String(payload.message || "").slice(0, 5000),
    targetType: payload.targetType === "section" ? "section" : "schedule",
    targetId: String(payload.targetId || "").slice(0, 160),
    targetLabel: String(payload.targetLabel || "").slice(0, 220),
    status,
    createdByUid: profile.uid,
    createdByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  }, { merge: true });
  await appendChangeArchive("task", taskId, "tâche : " + status, {
    title: before.title || "",
    message: before.message || "",
    status: before.status || "pending",
    targetType: before.targetType || "schedule",
    targetId: before.targetId || "",
    targetLabel: before.targetLabel || ""
  }, {
    title: after.title || "",
    message: after.message || "",
    status: after.status || "pending",
    targetType: after.targetType || "schedule",
    targetId: after.targetId || "",
    targetLabel: after.targetLabel || ""
  }, profile);
}

export async function completeActionTask(taskId, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas terminer cette tâche.");
  if (!/^[a-z0-9-]{3,160}$/i.test(String(taskId || ""))) throw new Error("Identifiant de tâche invalide.");
  const reference = doc(db, "tasks", taskId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Cette tâche n’existe plus.");
  if (profile.role !== "admin" && existing.data().createdByUid !== profile.uid) throw new Error("Seule l’administration ou l’auteur de la tâche peut la terminer.");
  await updateDoc(reference, {
    status: "done",
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  });
  await appendChangeArchive("task", taskId, "tâche complétée manuellement", {
    title: existing.data()?.title || "",
    message: existing.data()?.message || "",
    status: existing.data()?.status || "pending",
    targetType: existing.data()?.targetType || "schedule",
    targetId: existing.data()?.targetId || "",
    targetLabel: existing.data()?.targetLabel || ""
  }, {
    title: existing.data()?.title || "",
    message: existing.data()?.message || "",
    status: "done",
    targetType: existing.data()?.targetType || "schedule",
    targetId: existing.data()?.targetId || "",
    targetLabel: existing.data()?.targetLabel || ""
  }, profile);
}

export function subscribeActionTasks(callback, onError) {
  requireConfigured();
  const tasksQuery = query(collection(db, "tasks"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(
    tasksQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

function personalActionSnapshotValue(item) {
  const data = typeof item?.data === "function" ? item.data() : (item || {});
  return { ...data, id: String(item?.id || data.id || "") };
}

export function actionItemQueueKey(value = {}) {
  const id = String(value.id || "");
  const assigneeUid = String(value.assigneeUid || "");
  const assigneeRole = String(value.assigneeRole || "");
  const state = value.state === "done" ? "done" : value.state === "pending" ? "pending" : "";
  const priorityKey = Number(value.priorityKey);
  const eventDateIso = String(value.eventDateIso || "");
  if (!id || !/^[A-Za-z0-9_-]{3,180}$/.test(id)) throw new Error("Identifiant de décision invalide pour la file.");
  if (!assigneeUid || assigneeUid.length > 128) throw new Error("Destinataire invalide pour la file.");
  if (!['director', 'admin'].includes(assigneeRole)) throw new Error("Rôle invalide pour la file.");
  if (!state) throw new Error("État invalide pour la file.");
  if (!Number.isInteger(priorityKey) || priorityKey < 0 || priorityKey > 9999) throw new Error("Priorité invalide pour la file.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDateIso)) throw new Error("Date invalide pour la file.");
  const stateToken = state === "pending" ? "p" : "d";
  return `aq1|${assigneeUid.length}|${assigneeUid}|${assigneeRole}|${stateToken}|${String(priorityKey).padStart(4, "0")}|${eventDateIso}|${id}`;
}

export function personalPendingActionBounds(profile = {}) {
  const assigneeUid = String(profile.uid || "");
  const assigneeRole = String(profile.role || "");
  if (!assigneeUid || assigneeUid.length > 128 || !["director", "admin"].includes(assigneeRole)) {
    throw new Error("Profil invalide pour la file personnelle.");
  }
  const lower = `aq1|${assigneeUid.length}|${assigneeUid}|${assigneeRole}|p|`;
  return { lower, upper: `${lower}\uf8ff` };
}

function comparePersonalActions(left, right) {
  return Number(left.priorityKey ?? 9999) - Number(right.priorityKey ?? 9999)
    || String(left.eventDateIso || "9999-12-31").localeCompare(String(right.eventDateIso || "9999-12-31"))
    || String(left.id || "").localeCompare(String(right.id || ""));
}

export function personalActionHeadSignature(documents = []) {
  return documents.map((item) => {
    const value = personalActionSnapshotValue(item);
    return [value.id, value.priorityKey ?? 9999, value.eventDateIso || "9999-12-31"].join("\u0000");
  }).join("\u0001");
}

export function displacedPersonalActionHead(previousDocuments = [], nextDocuments = []) {
  const nextIds = new Set(nextDocuments.map((item) => personalActionSnapshotValue(item).id));
  return previousDocuments.filter((item) => !nextIds.has(personalActionSnapshotValue(item).id));
}

export function mergePersonalActionWindows(liveDocuments = [], retainedPages = [], boundaryDocuments = []) {
  const byId = new Map();
  [...retainedPages.flat(), ...boundaryDocuments, ...liveDocuments].forEach((item) => {
    const value = personalActionSnapshotValue(item);
    if (value.id) byId.set(value.id, value);
  });
  return [...byId.values()].sort(comparePersonalActions);
}

/**
 * File Firestore strictement personnelle et bornée.
 *
 * Un seul listener maintient la première fenêtre. Les pages suivantes sont
 * lues une seule fois, avec un curseur startAfter; elles restent en mémoire
 * et sont dédupliquées avec la fenêtre vivante. Le DOM historique demeure un
 * repli indépendant si cette collection est indisponible. Une clé unique
 * ordonnable évite tout index composite et encode compte, rôle, état, priorité,
 * date et identifiant dans un ordre stable.
 */
export function subscribePersonalActionItems(profile, callback, onError) {
  requireConfigured();
  if (!profile?.uid || !["director", "admin"].includes(profile.role)) {
    throw new Error("Profil requis pour charger la file personnelle.");
  }
  const pageSize = profile.role === "director" ? 5 : 7;
  const queueBounds = personalPendingActionBounds(profile);
  const constraints = [
    where("queueKey", ">=", queueBounds.lower),
    where("queueKey", "<", queueBounds.upper),
    orderBy("queueKey", "asc")
  ];
  let liveDocs = [];
  let retainedPages = [];
  let boundaryDocs = [];
  let headSignature = "";
  let desiredPageCount = 0;
  let pageCursor = null;
  let hasMore = true;
  let tailExhausted = false;
  let loading = false;
  let rebasing = false;
  let rebaseRequested = false;
  let stopped = false;
  let lastError = "";

  const emit = (extra = {}) => {
    callback(mergePersonalActionWindows(liveDocs, retainedPages, boundaryDocs), {
      pageSize,
      hasMore,
      loading: loading || rebasing,
      error: lastError,
      ...extra
    });
  };

  const pageQueryAfter = (cursor) => query(
    collection(db, "actionItems"),
    ...constraints,
    startAfter(cursor),
    limit(pageSize)
  );

  async function rebaseLoadedPages() {
    if (stopped || rebasing || desiredPageCount < 1) return;
    if (!liveDocs.length) {
      retainedPages = [];
      boundaryDocs = [];
      desiredPageCount = 0;
      pageCursor = null;
      tailExhausted = true;
      hasMore = false;
      rebaseRequested = false;
      emit({ source: "rebase-empty" });
      return;
    }
    rebasing = true;
    rebaseRequested = false;
    const expectedHead = headSignature;
    const targetPageCount = desiredPageCount;
    let rebaseCursor = liveDocs.at(-1) || null;
    const nextPages = [];
    let exhausted = liveDocs.length < pageSize;
    emit({ source: "rebase-start" });
    try {
      for (let page = 0; page < targetPageCount && rebaseCursor && !exhausted; page += 1) {
        const snapshot = await getDocs(pageQueryAfter(rebaseCursor));
        if (stopped) return;
        if (headSignature !== expectedHead) {
          rebaseRequested = true;
          break;
        }
        if (snapshot.docs.length) {
          nextPages.push(snapshot.docs);
          rebaseCursor = snapshot.docs.at(-1);
        }
        exhausted = snapshot.docs.length < pageSize;
      }
      if (!rebaseRequested && headSignature === expectedHead) {
        retainedPages = nextPages;
        boundaryDocs = [];
        desiredPageCount = nextPages.length;
        pageCursor = rebaseCursor || liveDocs.at(-1) || null;
        tailExhausted = exhausted;
        hasMore = !tailExhausted && Boolean(pageCursor);
        lastError = "";
      }
    } catch (error) {
      if (!stopped) {
        lastError = error?.message || "Impossible d’actualiser les pages déjà chargées.";
        onError?.(error);
      }
    } finally {
      rebasing = false;
      if (!stopped) emit({ source: "rebase-complete" });
      if (!stopped && rebaseRequested) void rebaseLoadedPages();
    }
  }

  const firstPageQuery = query(collection(db, "actionItems"), ...constraints, limit(pageSize));
  const unsubscribe = onSnapshot(firstPageQuery, (snapshot) => {
    const nextSignature = personalActionHeadSignature(snapshot.docs);
    const headChanged = Boolean(headSignature && nextSignature !== headSignature);
    if (headChanged && desiredPageCount > 0) {
      boundaryDocs = mergePersonalActionWindows(
        [],
        [boundaryDocs],
        displacedPersonalActionHead(liveDocs, snapshot.docs)
      );
      rebaseRequested = true;
    }
    lastError = "";
    liveDocs = snapshot.docs;
    headSignature = nextSignature;
    if (desiredPageCount < 1) {
      pageCursor = liveDocs.at(-1) || null;
      tailExhausted = snapshot.docs.length < pageSize;
      hasMore = !tailExhausted && Boolean(pageCursor);
    }
    emit({ source: snapshot.metadata.fromCache ? "cache" : "server" });
    if (rebaseRequested) void rebaseLoadedPages();
  }, (error) => {
    hasMore = false;
    lastError = error?.message || "File personnelle indisponible.";
    emit();
    onError?.(error);
  });

  async function loadMore() {
    if (stopped || loading || rebasing || !hasMore || !pageCursor) return;
    loading = true;
    const expectedHead = headSignature;
    const requestedPageCount = desiredPageCount + 1;
    emit();
    try {
      const nextPage = await getDocs(pageQueryAfter(pageCursor));
      if (stopped) return;
      if (headSignature !== expectedHead) {
        desiredPageCount = Math.max(desiredPageCount, requestedPageCount);
        rebaseRequested = true;
        return;
      }
      if (nextPage.docs.length) retainedPages.push(nextPage.docs);
      boundaryDocs = [];
      desiredPageCount = retainedPages.length;
      lastError = "";
      pageCursor = nextPage.docs.at(-1) || pageCursor;
      tailExhausted = nextPage.docs.length < pageSize;
      hasMore = !tailExhausted;
      emit({ source: nextPage.metadata.fromCache ? "cache" : "server" });
    } catch (error) {
      if (!stopped) {
        lastError = error?.message || "Impossible de charger la suite.";
        emit();
        onError?.(error);
      }
    } finally {
      loading = false;
      if (!stopped) emit();
      if (!stopped && rebaseRequested) void rebaseLoadedPages();
    }
  }

  return {
    loadMore,
    setLocalState(actionItemId, nextState) {
      if (nextState === "done") {
        liveDocs = liveDocs.filter((item) => item.id !== actionItemId);
        retainedPages = retainedPages.map((page) => page.filter((item) => item.id !== actionItemId));
        boundaryDocs = boundaryDocs.filter((item) => personalActionSnapshotValue(item).id !== actionItemId);
        headSignature = personalActionHeadSignature(liveDocs);
      }
      if (desiredPageCount > 0) {
        rebaseRequested = true;
        void rebaseLoadedPages();
      }
      emit();
    },
    unsubscribe() {
      stopped = true;
      unsubscribe();
      liveDocs = [];
      retainedPages = [];
      boundaryDocs = [];
    }
  };
}

export async function setPersonalActionItemState(actionItemId, state, profile) {
  requireConfigured();
  if (!profile?.uid || !["director", "admin"].includes(profile.role)) throw new Error("Profil requis pour mettre à jour cette décision.");
  if (!/^[A-Za-z0-9_-]{3,180}$/.test(String(actionItemId || ""))) throw new Error("Décision personnelle invalide.");
  const nextState = state === "done" ? "done" : "pending";
  const mutationId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const reference = doc(db, "actionItems", actionItemId);
  // Une lecture ciblée de ce seul document permet de reconstruire la clé de
  // file lors d'un retour done -> pending, même après rechargement du cockpit.
  // Aucune requête de collection ni aucun index composite n'est impliqué.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Cette décision personnelle n’existe plus.");
    const current = snapshot.data();
    if (current.assigneeUid !== profile.uid || current.assigneeRole !== profile.role) {
      throw new Error("Cette décision appartient à une autre file personnelle.");
    }
    transaction.update(reference, {
      state: nextState,
      queueKey: actionItemQueueKey({ ...current, id: actionItemId, state: nextState }),
      updatedAt: serverTimestamp(),
      updatedBy: profile.uid,
      lastMutationId: mutationId
    });
  });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cockpit:action-item-state-saved", { detail: { id: actionItemId, state: nextState } }));
}

export async function updateCockpitFeedbackStatus(feedbackId, status, profile) {
  requireConfigured();
  if (!profile || profile.role !== "admin") {
    throw new Error("Seule l’administration peut classer une rétroaction.");
  }
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(feedbackId || ""))) throw new Error("Rétroaction invalide.");
  if (!["open", "in_review", "done"].includes(status)) throw new Error("Statut de rétroaction invalide.");
  await updateDoc(doc(db, "cockpitFeedback", feedbackId), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  });
}

export function subscribeCockpitFeedback(callback, onError) {
  requireConfigured();
  const feedbackQuery = query(collection(db, "cockpitFeedback"), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(
    feedbackQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeAuditLogs(callback, onError) {
  requireConfigured();
  const logsQuery = query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(
    logsQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}
