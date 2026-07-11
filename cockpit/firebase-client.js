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
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
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
        .sort((a, b) => String(a.dateKey || "").localeCompare(String(b.dateKey || "")));
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

const workflowStages = new Set(["proposal", "content_review", "changes_requested", "content_changes_requested", "content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);

export async function setWorkflowStage(eventId, stage, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas modifier le cycle de validation.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(eventId || "")) || !workflowStages.has(stage)) throw new Error("Étape de validation invalide.");
  const reference = doc(db, "workflowStates", eventId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
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
  const stages = new Set(["source", "draft", "approved", "published", "reference"]);
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

export async function setMediaFinalChoice(mediaId, selected, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas retenir le média final.");
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(mediaId || ""))) throw new Error("Média invalide.");
  const reference = doc(db, "mediaLinks", mediaId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Ce média n’existe plus.");
  const before = existing.data();
  const next = {
    selectedFinal: Boolean(selected),
    approvedAt: selected ? serverTimestamp() : null,
    approvedBy: selected ? profile.uid : "",
    approvedByLabel: selected ? String(profile.displayLabel || "Direction").slice(0, 120) : "",
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  };
  await updateDoc(reference, next);
  await appendChangeArchive("mediaLink", mediaId, selected ? "média final retenu" : "média retiré du choix final", { selectedFinal: before.selectedFinal === true }, { selectedFinal: Boolean(selected) }, profile);
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
  if (!profile || profile.role !== "admin") {
    throw new Error("Seule l’administration peut forcer l’achèvement d’une tâche.");
  }
  if (!/^[a-z0-9-]{3,160}$/i.test(String(taskId || ""))) throw new Error("Identifiant de tâche invalide.");
  const reference = doc(db, "tasks", taskId);
  const existing = await getDoc(reference);
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
