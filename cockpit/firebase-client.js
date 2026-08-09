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
  clearIndexedDbPersistence,
  terminate,
  disableNetwork,
  enableNetwork,
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
import { normalizePublicationDraft, schedulePayloadFromDraft, validatePublicationDraft } from "./publication-editor-schema.mjs?v=20260809-b53";
import { normalizeProjectCalendarEvent, normalizeProjectEventProposal } from "./project-calendar-model.mjs?v=20260809-b53";
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
const CACHE_PREFERENCE_KEY = "bleu-massawippi-firestore-cache-v1";
const SAFE_MODE_QUERY_KEY = "safe";
const queryParameters = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const safeModeRequested = queryParameters.get(SAFE_MODE_QUERY_KEY) === "1";
const persistentCacheRequested = safeModeRequested
  || queryParameters.get("offline") === "1"
  || (typeof localStorage !== "undefined" && localStorage.getItem(CACHE_PREFERENCE_KEY) === "persistent");
let networkReady = Promise.resolve();
let listenerSequence = 0;
const diagnosticSubscribers = new Set();
const diagnostics = {
  safeMode: safeModeRequested,
  networkState: safeModeRequested ? "cache-only" : (typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online"),
  persistenceState,
  persistentCacheRequested,
  activeListeners: 0,
  listenerNames: [],
  deliveredDocuments: 0,
  deliveredFromCache: 0,
  confirmedWrites: 0,
  lastServerSyncAt: "",
  lastErrorAt: "",
  lastErrorCode: "",
  lastErrorMessage: ""
};
const activeListenerNames = new Map();
const REQUEST_TIMEOUT_MS = 15000;

function diagnosticsSnapshot() {
  return Object.freeze({
    ...diagnostics,
    persistenceState,
    listenerNames: [...activeListenerNames.values()].sort()
  });
}

function emitDiagnostics() {
  const snapshot = diagnosticsSnapshot();
  diagnosticSubscribers.forEach((subscriber) => {
    try { subscriber(snapshot); } catch (error) { console.warn("Diagnostic client non rendu", error); }
  });
  if (typeof dispatchEvent === "function" && typeof CustomEvent === "function") {
    dispatchEvent(new CustomEvent("cockpit:client-diagnostics", { detail: snapshot }));
  }
}

function recordClientError(error) {
  diagnostics.lastErrorAt = new Date().toISOString();
  diagnostics.lastErrorCode = String(error?.code || "unknown").slice(0, 120);
  diagnostics.lastErrorMessage = String(error?.message || error || "Erreur inconnue").slice(0, 500);
  emitDiagnostics();
}

function recordConfirmedWrites(count = 1) {
  diagnostics.confirmedWrites += Math.max(0, Number(count) || 0);
  emitDiagnostics();
}

function trackedOnSnapshot(name, reference, onNext, onError, { includeMetadataChanges = false } = {}) {
  const listenerId = `${String(name || "listener").slice(0, 80)}#${++listenerSequence}`;
  activeListenerNames.set(listenerId, String(name || "listener").slice(0, 80));
  diagnostics.activeListeners = activeListenerNames.size;
  emitDiagnostics();
  let closed = false;
  const unsubscribe = onSnapshot(
    reference,
    { includeMetadataChanges },
    (snapshot) => {
      const size = Number.isFinite(snapshot?.size) ? snapshot.size : snapshot?.exists?.() ? 1 : 0;
      diagnostics.deliveredDocuments += size;
      if (snapshot?.metadata?.fromCache) diagnostics.deliveredFromCache += size;
      else diagnostics.lastServerSyncAt = new Date().toISOString();
      emitDiagnostics();
      onNext(snapshot);
    },
    (error) => {
      recordClientError(error);
      onError?.(error);
    }
  );
  return () => {
    if (closed) return;
    closed = true;
    activeListenerNames.delete(listenerId);
    diagnostics.activeListeners = activeListenerNames.size;
    emitDiagnostics();
    unsubscribe();
  };
}

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
    if (persistentCacheRequested) {
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
  diagnostics.persistenceState = persistenceState;
  if (safeModeRequested) {
    networkReady = disableNetwork(db)
      .then(() => {
        diagnostics.networkState = "cache-only";
        emitDiagnostics();
      })
      .catch((error) => {
        recordClientError(error);
        throw error;
      });
  }
  setPersistence(auth, browserLocalPersistence).catch(() => {
    persistenceState = "unavailable";
    diagnostics.persistenceState = persistenceState;
    emitDiagnostics();
  });
}

if (typeof addEventListener === "function") {
  addEventListener("online", () => {
    if (!safeModeRequested) diagnostics.networkState = "online";
    emitDiagnostics();
  });
  addEventListener("offline", () => {
    if (!safeModeRequested) diagnostics.networkState = "offline";
    emitDiagnostics();
  });
}

function requireConfigured() {
  if (!configured) {
    throw new Error("Firebase n’est pas configuré. Renseignez firebase-config.js.");
  }
}

function requireWritable() {
  requireConfigured();
  if (safeModeRequested) throw new Error("Le mode secours est en lecture seule. Revenez au mode normal pour enregistrer un changement.");
}

function changeArchiveEntry(entityType, entityId, action, before, after, profile) {
  const compact = (value) => {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, typeof item === "string" ? item.slice(0, 5000) : item]));
  };
  return {
    entityType: String(entityType || "unknown").slice(0, 80),
    entityId: String(entityId || "unknown").slice(0, 160),
    action: String(action || "modification").slice(0, 160),
    before: compact(before),
    after: compact(after),
    actorUid: profile?.uid || "",
    actorLabel: String(profile?.displayLabel || "Utilisateur").slice(0, 120),
    createdAt: serverTimestamp()
  };
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
  return { configured, persistenceState, persistentCacheRequested, safeMode: safeModeRequested, auth, db };
}

export async function waitForClientReady() {
  await networkReady;
  return diagnosticsSnapshot();
}

export function getClientDiagnostics() {
  return diagnosticsSnapshot();
}

export function subscribeClientDiagnostics(callback) {
  if (typeof callback !== "function") return () => {};
  diagnosticSubscribers.add(callback);
  callback(diagnosticsSnapshot());
  return () => diagnosticSubscribers.delete(callback);
}

export function setPersistentCachePreference(enabled) {
  if (typeof localStorage === "undefined") return;
  if (enabled) localStorage.setItem(CACHE_PREFERENCE_KEY, "persistent");
  else localStorage.removeItem(CACHE_PREFERENCE_KEY);
}

export function requestSafeMode(enabled) {
  if (typeof location === "undefined") return;
  const url = new URL(location.href);
  if (enabled) url.searchParams.set(SAFE_MODE_QUERY_KEY, "1");
  else url.searchParams.delete(SAFE_MODE_QUERY_KEY);
  location.assign(url.href);
}

export async function forgetThisDevice() {
  requireConfigured();
  try { await signOut(auth); } catch (error) { recordClientError(error); }
  try { await disableNetwork(db); } catch (error) { recordClientError(error); }
  await terminate(db);
  await clearIndexedDbPersistence(db);
  if (typeof localStorage !== "undefined") localStorage.removeItem(CACHE_PREFERENCE_KEY);
  diagnostics.networkState = "cleared";
  diagnostics.persistenceState = "cleared";
  emitDiagnostics();
}

export async function fetchPrivateContent() {
  requireConfigured();
  await waitForClientReady();
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
  await waitForClientReady();
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
  const scheduleQuery = query(collection(db, "scheduleItems"), orderBy("dateIso", "asc"), limit(120));
  const unsubscribe = trackedOnSnapshot(
    "scheduleItems",
    scheduleQuery,
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
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit de modifier le calendrier.");
  }
  const reference = doc(db, "scheduleItems", itemId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Cette publication n’existe plus.");
  const before = existing.data();
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, {
    ...changes,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  });
  batch.set(archiveReference, changeArchiveEntry("scheduleItem", itemId, "calendrier modifié", before, { ...before, ...changes }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export async function upsertScheduleItem(itemId, payload, profile) {
  requireWritable();
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
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.set(reference, {
    ...payload,
    deleted: payload.status === "deleted",
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  }, { merge: true });
  batch.set(archiveReference, changeArchiveEntry("scheduleItem", itemId, "calendrier : " + payload.status, {
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
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export async function savePublicationContent(draft, profile, { expectedRevision = 0, action = "publication modifiée", mustCreate = false } = {}) {
  requireWritable();
  if (!profile || profile.role !== "admin") throw new Error("Le Studio de publication est réservé aux communications.");
  const errors = validatePublicationDraft(draft);
  if (errors.length) throw new Error(errors.join(" "));
  const normalized = normalizePublicationDraft(draft);
  if (!normalized.id.match(/^[a-z0-9-]{3,80}$/i)) throw new Error("Identifiant de publication invalide.");
  const reference = doc(db, "scheduleItems", normalized.id);
  const mutationId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const archiveReference = doc(db, "changeArchive", `publication-${normalized.id}-${mutationId}`.slice(0, 160));
  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (mustCreate && snapshot.exists()) {
      throw new Error("Cet identifiant vient d’être utilisé. Modifiez légèrement le titre ou la date, puis réessayez.");
    }
    const before = snapshot.exists() ? snapshot.data() : {};
    const currentRevision = Number(before.editorial?.revision || 0);
    if (currentRevision !== Number(expectedRevision || 0)) {
      throw new Error("Cette publication a changé depuis son ouverture. Rechargez-la avant d’enregistrer.");
    }
    const payload = schedulePayloadFromDraft(normalized, before);
    const editorial = {
      ...payload.editorial,
      createdBy: before.editorial?.createdBy || profile.uid,
      createdAt: before.editorial?.createdAt || serverTimestamp()
    };
    const after = {
      ...payload,
      editorial,
      updatedAt: serverTimestamp(),
      updatedBy: profile.uid
    };
    transaction.set(reference, after, { merge: snapshot.exists() });
    transaction.set(archiveReference, changeArchiveEntry(
      "publicationContent",
      normalized.id,
      String(action || (snapshot.exists() ? "publication modifiée" : "publication créée")).slice(0, 160),
      before,
      after,
      profile
    ));
    return { id: normalized.id, revision: payload.editorial.revision, created: !snapshot.exists() };
  });
  recordConfirmedWrites(2);
  return result;
}

export async function fetchPublicationHistory(itemId, { pageSize = 20 } = {}) {
  requireConfigured();
  const id = String(itemId || "").trim();
  if (!id.match(/^[a-z0-9-]{3,80}$/i)) throw new Error("Identifiant de publication invalide.");
  const historyQuery = query(
    collection(db, "changeArchive"),
    where("entityType", "==", "publicationContent"),
    where("entityId", "==", id),
    orderBy("createdAt", "desc"),
    limit(Math.min(40, Math.max(1, Number(pageSize) || 20)))
  );
  const snapshot = await getDocs(historyQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function setScheduleSelection(itemId, groupIds, selected, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’arbitrer le calendrier.");
  }
  const ids = [...new Set([itemId, ...(Array.isArray(groupIds) ? groupIds : [])])]
    .filter((id) => /^[a-z0-9-]{3,80}$/i.test(String(id)));
  if (!ids.includes(itemId)) throw new Error("Groupe de choix invalide.");
  const beforeDocs = await Promise.all(ids.map((id) => getDoc(doc(db, "scheduleItems", id))));
  const batch = writeBatch(db);
  for (const [index, id] of ids.entries()) {
    batch.update(doc(db, "scheduleItems", id), {
      selected: Boolean(selected) && id === itemId,
      updatedAt: serverTimestamp(),
      updatedBy: profile.uid
    });
    const before = beforeDocs[index].exists() ? beforeDocs[index].data() : {};
    batch.set(doc(collection(db, "changeArchive")), changeArchiveEntry("scheduleItem", id, "choix éditorial : " + (selected && id === itemId ? "sélectionné" : "désélectionné"), {
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
    }, profile));
  }
  await batch.commit();
  recordConfirmedWrites(ids.length * 2);
}

export async function addComment(itemId, comment, profile, quickTag = null, dictated = false) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’ajouter un commentaire.");
  }
  const text = String(comment || "").trim();
  if (!text) return;
  const now = serverTimestamp();
  const reference = doc(collection(db, "comments"));
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.set(reference, {
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
  batch.set(archiveReference, changeArchiveEntry("comment", reference.id, dictated ? "commentaire dicté" : "commentaire ajouté", {}, {
    sectionId: itemId,
    comment: text,
    quickTag: quickTag || null,
    dictated: Boolean(dictated)
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
  return reference.id;
}

export function subscribeComments(callback, onError) {
  requireConfigured();
  const commentsQuery = query(collection(db, "comments"), orderBy("updatedAt", "desc"), limit(120));
  return trackedOnSnapshot("comments", commentsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).reverse()), onError);
}

export function subscribeCommentsForSection(sectionId, callback, onError) {
  requireConfigured();
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(sectionId || ""))) throw new Error("Section de commentaires invalide.");
  const commentsQuery = query(collection(db, "comments"), where("sectionId", "==", sectionId), orderBy("createdAt", "desc"), limit(60));
  return trackedOnSnapshot(`comments:${sectionId}`, commentsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).reverse()), onError);
}

export async function updateOwnComment(commentId, text, profile) {
  requireWritable();
  const reference = doc(db, "comments", commentId);
  const existing = await getDoc(reference);
  if (!existing.exists() || existing.data().authorUid !== profile?.uid) throw new Error("Vous pouvez modifier uniquement votre propre commentaire.");
  const comment = String(text || "").trim().slice(0, 5000);
  if (!comment) throw new Error("Le commentaire ne peut pas être vide.");
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, { comment, updatedAt: serverTimestamp(), updatedBy: profile.uid });
  batch.set(archiveReference, changeArchiveEntry("comment", commentId, "commentaire modifié", { comment: existing.data().comment || "" }, { comment }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export async function archiveOwnComment(commentId, profile) {
  requireWritable();
  const reference = doc(db, "comments", commentId);
  const existing = await getDoc(reference);
  if (!existing.exists() || existing.data().authorUid !== profile?.uid) throw new Error("Vous pouvez archiver uniquement votre propre commentaire.");
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, { deleted: true, updatedAt: serverTimestamp(), updatedBy: profile.uid });
  batch.set(archiveReference, changeArchiveEntry("comment", commentId, "commentaire archivé", { deleted: false, comment: existing.data().comment || "" }, { deleted: true, comment: existing.data().comment || "" }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export async function resolveComment(commentId, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas traiter ce commentaire.");
  const reference = doc(db, "comments", commentId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Ce commentaire n’existe plus.");
  const before = existing.data();
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, {
    resolved: true,
    resolvedAt: serverTimestamp(),
    resolvedBy: profile.uid,
    resolvedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  });
  batch.set(archiveReference, changeArchiveEntry("comment", commentId, "commentaire traité", {
    resolved: before.resolved === true,
    comment: before.comment || ""
  }, {
    resolved: true,
    comment: before.comment || ""
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

const workflowStages = new Set(["proposal", "content_review", "changes_requested", "content_changes_requested", "content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);
const contentApprovedWorkflowStages = new Set(["content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);

export async function setWorkflowStage(eventId, stage, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas modifier le cycle de validation.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(eventId || "")) || !workflowStages.has(stage)) throw new Error("Étape de validation invalide.");
  const reference = doc(db, "workflowStates", eventId);
  const mediaReference = doc(db, "mediaDecisions", eventId);
  const archiveReference = doc(collection(db, "changeArchive"));
  const actorLabel = String(profile.displayLabel || "Utilisateur").slice(0, 120);
  const mutationId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let confirmedWriteCount = 2;
  await runTransaction(db, async (transaction) => {
    const [existing, mediaSnapshot] = await Promise.all([
      transaction.get(reference),
      transaction.get(mediaReference)
    ]);
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

    let nextStage = stage;
    let mediaBefore = null;
    let mediaAfter = null;
    if (mediaSnapshot.exists()) {
      mediaBefore = normalizeMediaDecision(mediaSnapshot.data(), eventId);
      const textApproved = contentApprovedWorkflowStages.has(stage);
      const agreement = deriveMediaAgreement(mediaBefore.communications, mediaBefore.direction, mediaBefore.override, textApproved);
      if (stage === "content_approved" && ["agreed", "overridden"].includes(agreement.status)) nextStage = "final_approved";
      mediaAfter = {
        ...mediaBefore,
        agreement,
        textGateStage: nextStage,
        lastMutationId: `workflow-${mutationId}`.slice(0, 160),
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
        updatedByLabel: actorLabel
      };
      transaction.set(mediaReference, mediaAfter);
      confirmedWriteCount += 1;
    }

    transaction.set(reference, {
      eventId,
      stage: nextStage,
      updatedAt: serverTimestamp(),
      updatedBy: profile.uid,
      updatedByLabel: actorLabel
    }, { merge: true });
    transaction.set(archiveReference, changeArchiveEntry(
      "workflowState",
      eventId,
      "cycle : " + nextStage,
      { stage: before.stage || "proposal", ...(mediaBefore ? { mediaDecision: mediaDecisionArchiveView(mediaBefore) } : {}) },
      { stage: nextStage, ...(mediaAfter ? { mediaDecision: mediaDecisionArchiveView(mediaAfter) } : {}) },
      profile
    ));
  });
  recordConfirmedWrites(confirmedWriteCount);
}

export function subscribeWorkflowStates(callback, onError) {
  requireConfigured();
  const statesQuery = query(collection(db, "workflowStates"), orderBy("updatedAt", "desc"), limit(100));
  return trackedOnSnapshot("workflowStates", statesQuery, (snapshot) => callback(
    snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    { fromCache: snapshot.metadata.fromCache, hasPendingWrites: snapshot.metadata.hasPendingWrites }
  ), onError, { includeMetadataChanges: true });
}

const opportunityStages = new Set(["watch", "research", "active", "submitted", "completed"]);

export async function setOpportunityStage(opportunityId, stage, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas modifier le suivi des occasions.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(opportunityId || "")) || !opportunityStages.has(stage)) throw new Error("Étape de projet invalide.");
  const reference = doc(db, "opportunityStates", opportunityId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.set(reference, {
    opportunityId,
    stage,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    updatedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120)
  }, { merge: true });
  batch.set(archiveReference, changeArchiveEntry("opportunityState", opportunityId, "occasion : " + stage, { stage: before.stage || "watch" }, { stage }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export function subscribeOpportunityStates(callback, onError) {
  requireConfigured();
  const statesQuery = query(collection(db, "opportunityStates"), orderBy("updatedAt", "desc"), limit(50));
  return trackedOnSnapshot("opportunityStates", statesQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

const internalProjectStages = new Set(["to_frame", "planned", "active", "blocked", "completed"]);

export async function setInternalProjectStage(projectId, stage, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas modifier le suivi des projets internes.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(projectId || "")) || !internalProjectStages.has(stage)) throw new Error("Étape de projet interne invalide.");
  const reference = doc(db, "internalProjectStates", projectId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.set(reference, {
    projectId,
    stage,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    updatedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120)
  }, { merge: true });
  batch.set(archiveReference, changeArchiveEntry("internalProjectState", projectId, "projet interne : " + stage, { stage: before.stage || "to_frame" }, { stage }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export function subscribeInternalProjectStates(callback, onError) {
  requireConfigured();
  const statesQuery = query(collection(db, "internalProjectStates"), orderBy("updatedAt", "desc"), limit(50));
  return trackedOnSnapshot("internalProjectStates", statesQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function addProjectEventProposal(input, profile) {
  requireWritable();
  if (!profile?.uid || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte ne peut pas proposer un événement.");
  }
  const proposal = normalizeProjectEventProposal(input);
  const reference = doc(collection(db, "projectEventProposals"));
  const archiveReference = doc(collection(db, "changeArchive"));
  const payload = {
    ...proposal,
    authorUid: profile.uid,
    authorRole: profile.role,
    authorLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  };
  const batch = writeBatch(db);
  batch.set(reference, payload);
  batch.set(archiveReference, changeArchiveEntry("projectEventProposal", reference.id, "nouvelle proposition de calendrier", {}, {
    title: proposal.title,
    startDate: proposal.startDate,
    endDate: proposal.endDate,
    urgency: proposal.urgency,
    status: proposal.status
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
  return reference.id;
}

export function subscribeProjectEventProposals(callback, onError, maximum = 30) {
  requireConfigured();
  const boundedMaximum = Math.max(1, Math.min(50, Number(maximum) || 30));
  const proposalsQuery = query(collection(db, "projectEventProposals"), orderBy("createdAt", "desc"), limit(boundedMaximum));
  return trackedOnSnapshot("projectEventProposals", proposalsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function setProjectEventProposalStatus(proposalId, status, convertedEventId, profile) {
  requireWritable();
  if (!profile?.uid || profile.role !== "admin") throw new Error("Seules les communications peuvent classer une proposition.");
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(proposalId || ""))) throw new Error("Proposition invalide.");
  if (!["submitted", "in_review", "converted", "closed"].includes(status)) throw new Error("Statut de proposition invalide.");
  const linkedEventId = status === "converted" ? String(convertedEventId || "").trim().slice(0, 160) : "";
  if (status === "converted" && !/^[A-Za-z0-9_-]{3,160}$/.test(linkedEventId)) throw new Error("L’événement final associé est requis.");
  const reference = doc(db, "projectEventProposals", proposalId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Cette proposition n’existe plus.");
  const before = existing.data();
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, { status, convertedEventId: linkedEventId, updatedAt: serverTimestamp(), updatedBy: profile.uid });
  batch.set(archiveReference, changeArchiveEntry("projectEventProposal", proposalId, "proposition : " + status, {
    status: before.status || "submitted",
    convertedEventId: before.convertedEventId || ""
  }, { status, convertedEventId: linkedEventId }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export function subscribeProjectCalendarEvents(callback, onError, { earliestDate, maximum = 120 } = {}) {
  requireConfigured();
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - 60);
  const floor = /^\d{4}-\d{2}-\d{2}$/.test(String(earliestDate || "")) ? String(earliestDate) : fallback.toISOString().slice(0, 10);
  const boundedMaximum = Math.max(1, Math.min(150, Number(maximum) || 120));
  const eventsQuery = query(collection(db, "projectCalendarEvents"), where("endDate", ">=", floor), orderBy("endDate", "asc"), limit(boundedMaximum));
  return trackedOnSnapshot("projectCalendarEvents", eventsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

export async function upsertProjectCalendarEvent(eventId, input, profile) {
  requireWritable();
  if (!profile?.uid || profile.role !== "admin") throw new Error("Seules les communications peuvent publier un événement final.");
  const safeId = String(eventId || "").trim();
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(safeId)) throw new Error("Identifiant d’événement invalide.");
  const event = normalizeProjectCalendarEvent(input);
  const reference = doc(db, "projectCalendarEvents", safeId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  const archiveReference = doc(collection(db, "changeArchive"));
  const payload = {
    ...event,
    eventId: safeId,
    createdAt: existing.exists() ? before.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    updatedByLabel: String(profile.displayLabel || "Direction des communications").slice(0, 120)
  };
  const batch = writeBatch(db);
  batch.set(reference, payload);
  batch.set(archiveReference, changeArchiveEntry("projectCalendarEvent", safeId, existing.exists() ? "événement de projet mis à jour" : "événement de projet créé", {
    title: before.title || "",
    startDate: before.startDate || "",
    endDate: before.endDate || "",
    stage: before.stage || ""
  }, {
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    stage: event.stage
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
  return safeId;
}

const editorialDecisionValues = new Set(["undecided", "chosen", "deferred", "rejected"]);

export async function setEditorialDecision(eventId, decision, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas arbitrer cette proposition.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(eventId || "")) || !editorialDecisionValues.has(decision)) throw new Error("Décision éditoriale invalide.");
  const reference = doc(db, "editorialDecisions", eventId);
  const existing = await getDoc(reference);
  const before = existing.exists() ? existing.data() : {};
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.set(reference, {
    eventId,
    decision,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid,
    updatedByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120)
  }, { merge: true });
  batch.set(archiveReference, changeArchiveEntry("editorialDecision", eventId, "arbitrage : " + decision, { decision: before.decision || "undecided" }, { decision }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export function subscribeEditorialDecisions(callback, onError) {
  requireConfigured();
  const decisionsQuery = query(collection(db, "editorialDecisions"), orderBy("updatedAt", "desc"), limit(100));
  return trackedOnSnapshot("editorialDecisions", decisionsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
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
  requireWritable();
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
  const reference = doc(collection(db, "mediaLinks"));
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.set(reference, data);
  batch.set(archiveReference, changeArchiveEntry("mediaLink", reference.id, "lien média ajouté", {}, {
    eventId, label: data.label, url: data.url, kind, stage, note: data.note, archived: false
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
  return reference.id;
}

export async function archiveMediaLink(mediaId, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’archiver un média.");
  }
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(mediaId || ""))) throw new Error("Média invalide.");
  const reference = doc(db, "mediaLinks", mediaId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Ce média n’existe plus.");
  const before = existing.data();
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, { archived: true, updatedAt: serverTimestamp(), updatedBy: profile.uid });
  batch.set(archiveReference, changeArchiveEntry("mediaLink", mediaId, "lien média archivé", {
    eventId: before.eventId || "", label: before.label || "", url: before.url || "", kind: before.kind || "other", stage: before.stage || "reference", note: before.note || "", archived: false
  }, {
    eventId: before.eventId || "", label: before.label || "", url: before.url || "", kind: before.kind || "other", stage: before.stage || "reference", note: before.note || "", archived: true
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

const MAX_MEDIA_CHOICES = 2;

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
    ? [...new Set(value.mediaIds.map((item) => String(item || "")).filter((item) => /^[A-Za-z0-9_-]{3,160}$/.test(item)))].sort().slice(0, MAX_MEDIA_CHOICES)
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
    ? [...new Set(value.mediaIds.map((item) => String(item || "")).filter((item) => /^[A-Za-z0-9_-]{3,160}$/.test(item)))].sort().slice(0, MAX_MEDIA_CHOICES)
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
  const canonicalLeft = [...left].sort();
  const canonicalRight = [...right].sort();
  return canonicalLeft.length === canonicalRight.length && canonicalLeft.every((item, index) => item === canonicalRight[index]);
}

function nextMediaSelection(previousIds, mediaId, selected, allowsMultiple) {
  const previous = Array.isArray(previousIds) ? previousIds : [];
  if (!allowsMultiple) return selected ? [mediaId] : [];
  return selected
    ? [...new Set([...previous, mediaId])].sort().slice(0, MAX_MEDIA_CHOICES)
    : previous.filter((id) => id !== mediaId).sort();
}

// Fonction pure exportée afin que le contrat de décision puisse être testé
// sans connexion Firebase. L'état dérivé ne remplace jamais les deux choix.
export function deriveMediaAgreement(communications, direction, override, textApproved) {
  const communicationsIds = communications?.status === "selected" && Array.isArray(communications.mediaIds) ? communications.mediaIds : [];
  const directionIds = direction?.status === "selected" && Array.isArray(direction.mediaIds) ? direction.mediaIds : [];
  const overrideIds = override?.active === true && Array.isArray(override.mediaIds) ? override.mediaIds : [];
  if (textApproved && overrideIds.length && String(override.reason || "").trim()) {
    return { status: "overridden", mediaIds: [...new Set(overrideIds)].sort(), divergent: false };
  }
  if (communicationsIds.length && directionIds.length) {
    if (textApproved && sameOrderedMedia(communicationsIds, directionIds)) {
      return { status: "agreed", mediaIds: [...new Set(communicationsIds)].sort(), divergent: false };
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
      mediaIds: Array.isArray(value?.agreement?.mediaIds) ? [...new Set(value.agreement.mediaIds)].sort().slice(0, MAX_MEDIA_CHOICES) : agreement.mediaIds,
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
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas choisir ce média.");
  if (!/^[a-z0-9-]{3,80}$/i.test(String(eventId || ""))) throw new Error("Événement média invalide.");
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(mediaId || ""))) throw new Error("Média invalide.");

  const mediaReference = doc(db, "mediaLinks", mediaId);
  const decisionReference = doc(db, "mediaDecisions", eventId);
  const workflowReference = doc(db, "workflowStates", eventId);
  const wantsOverride = options.override === true;
  const allowsMultiple = options.multiple === true;
  const overrideReason = String(options.reason || "").trim().slice(0, 500);
  if (wantsOverride && !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte ne peut pas appliquer un override média.");
  }
  const actorLabel = String(profile.displayLabel || "Utilisateur").slice(0, 120);
  const sideName = profile.role === "admin" ? "communications" : "direction";
  const mutationId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const archiveReference = doc(db, "changeArchive", `media-${mutationId}`.slice(0, 160));

  let confirmedWriteCount = 0;
  const result = await runTransaction(db, async (transaction) => {
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
    const adminOverrideApprovesText = wantsOverride && profile.role === "admin" && !textApproved;
    const effectiveTextApproved = textApproved || adminOverrideApprovesText;
    if (wantsOverride && (!selected || !effectiveTextApproved || !overrideReason)) {
      throw new Error("Un override exige un média choisi, un motif explicite et, sauf pour les communications, le texte approuvé.");
    }

    const before = normalizeMediaDecision(decisionSnapshot.exists() ? decisionSnapshot.data() : {}, eventId);
    const previousSideIds = before[sideName].status === "selected" ? before[sideName].mediaIds : [];
    const selectedSideIds = nextMediaSelection(previousSideIds, mediaId, selected, allowsMultiple);
    const selectedSideStatus = selectedSideIds.length ? "selected" : "revoked";
    const sameExistingChoice = before[sideName].status === selectedSideStatus
      && sameOrderedMedia(before[sideName].mediaIds, selectedSideIds)
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
      override: profile.role === "admin" && !wantsOverride
        ? { ...before.override, mediaIds: [...before.override.mediaIds] }
        : emptyOverride(),
      textGateStage: adminOverrideApprovesText ? "content_approved" : workflowStage
    };
    next[sideName] = {
      status: selectedSideStatus,
      mediaIds: selectedSideIds,
      actorUid: profile.uid,
      actorLabel,
      actorRole: profile.role,
      decidedAt: now
    };
    if (wantsOverride) {
      next.override = {
        active: true,
        mediaIds: selectedSideIds,
        reason: overrideReason,
        actorUid: profile.uid,
        actorLabel,
        actorRole: profile.role,
        decidedAt: now
      };
    }
    const agreement = deriveMediaAgreement(next.communications, next.direction, next.override, effectiveTextApproved);
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
    confirmedWriteCount = 2;
    if (!workflowSnapshot.exists() || nextWorkflowStage !== workflowStage) {
      transaction.set(workflowReference, {
        eventId,
        stage: nextWorkflowStage,
        updatedAt: now,
        updatedBy: profile.uid,
        updatedByLabel: actorLabel
      });
      confirmedWriteCount += 1;
    }
    transaction.set(archiveReference, {
      entityType: "mediaDecision",
      entityId: eventId,
      action: selected ? (wantsOverride ? (profile.role === "admin" ? "validation forcée par les communications" : "choix média confirmé par la direction") : `${sideName} : média choisi`) : `${sideName} : choix média retiré`,
      before: mediaDecisionArchiveView(before),
      after: mediaDecisionArchiveView(next),
      actorUid: profile.uid,
      actorLabel,
      createdAt: now
    });
    return next;
  });
  if (confirmedWriteCount) recordConfirmedWrites(confirmedWriteCount);
  return result;
}

export function subscribeMediaDecisions(callback, onError) {
  requireConfigured();
  // Fenêtre M0 bornée et transitoire : un seul listener de résumés, jamais un
  // listener par carte. La projection par fenêtre de dates remplacera ce
  // plafond après validation de parité.
  const decisionsQuery = query(collection(db, "mediaDecisions"), orderBy("updatedAt", "desc"), limit(80));
  return trackedOnSnapshot(
    "mediaDecisions",
    decisionsQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

// Compatibilité ascendante : les anciens clients peuvent encore écrire le
// marqueur global. Les nouveaux lecteurs le montrent comme héritage non
// attribué seulement lorsqu'aucune décision structurée n'existe.
export async function setMediaFinalChoice(mediaId, selected, profile) {
  requireWritable();
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
  recordConfirmedWrites(2);
}

export function subscribeMediaLinks(callback, onError) {
  requireConfigured();
  const mediaQuery = query(collection(db, "mediaLinks"), orderBy("updatedAt", "desc"), limit(160));
  return trackedOnSnapshot(
    "mediaLinks",
    mediaQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeMediaLinksForEvent(eventId, callback, onError) {
  requireConfigured();
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(eventId || ""))) throw new Error("Événement média invalide.");
  const mediaQuery = query(collection(db, "mediaLinks"), where("eventId", "==", eventId), orderBy("createdAt", "desc"), limit(40));
  return trackedOnSnapshot(
    `mediaLinks:${eventId}`,
    mediaQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function writeAuditLog(sectionId, action, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) return;
  await addDoc(collection(db, "auditLogs"), {
    sectionId: String(sectionId || "").slice(0, 120),
    action: String(action || "modification").slice(0, 120),
    userUid: profile.uid,
    userLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    createdAt: serverTimestamp()
  });
  recordConfirmedWrites(1);
}

export async function addCockpitFeedback(sectionId, message, category, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’envoyer une rétroaction.");
  }
  const text = String(message || "").trim();
  if (!text) return;
  const now = serverTimestamp();
  const reference = doc(collection(db, "cockpitFeedback"));
  const archiveReference = doc(collection(db, "changeArchive"));
  const payload = {
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
  };
  const batch = writeBatch(db);
  batch.set(reference, payload);
  batch.set(archiveReference, changeArchiveEntry("cockpitFeedback", reference.id, "rétroaction déposée", {}, {
    sectionId,
    message: text,
    category: String(category || "recommandation")
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
  return reference.id;
}

export async function upsertActionTask(taskId, payload, profile) {
  requireWritable();
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
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.set(reference, {
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
  batch.set(archiveReference, changeArchiveEntry("task", taskId, "tâche : " + status, {
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
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export async function completeActionTask(taskId, profile) {
  requireWritable();
  if (!profile || !["director", "admin"].includes(profile.role)) throw new Error("Ce compte ne peut pas terminer cette tâche.");
  if (!/^[a-z0-9-]{3,160}$/i.test(String(taskId || ""))) throw new Error("Identifiant de tâche invalide.");
  const reference = doc(db, "tasks", taskId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Cette tâche n’existe plus.");
  if (profile.role !== "admin" && existing.data().createdByUid !== profile.uid) throw new Error("Seule l’administration ou l’auteur de la tâche peut la terminer.");
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, {
    status: "done",
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  });
  batch.set(archiveReference, changeArchiveEntry("task", taskId, "tâche complétée manuellement", {
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
  }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export function subscribeActionTasks(callback, onError) {
  requireConfigured();
  // La file active ne relit plus l'historique complet à chaque ouverture du
  // cockpit. Les tâches terminées ont leur propre lecteur paresseux ci-dessous.
  const tasksQuery = query(collection(db, "tasks"), where("status", "==", "pending"), limit(200));
  return trackedOnSnapshot(
    "tasks",
    tasksQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

/**
 * Historique administrateur des tâches terminées.
 *
 * Lecture ponctuelle seulement : aucun listener, une petite page ordonnée par
 * dernière modification et un curseur DocumentSnapshot. La direction ne peut
 * pas appeler cette fonction et ne lit donc jamais l'historique de
 * l'administration.
 */
export async function fetchCompletedActionTasksPage(profile, { cursor = null, pageSize = 8 } = {}) {
  requireConfigured();
  if (!profile?.uid || profile.role !== "admin") {
    throw new Error("L’historique des tâches terminées est réservé à l’administration.");
  }
  const boundedPageSize = Math.max(1, Math.min(20, Number(pageSize) || 8));
  const constraints = [
    where("status", "==", "done"),
    orderBy("updatedAt", "desc")
  ];
  if (cursor) constraints.push(startAfter(cursor));
  // Un document de regard vers l'avant permet d'annoncer honnêtement la fin
  // de la file. Il sera relu au début de la page suivante, soit au plus une
  // lecture supplémentaire par action explicite « Charger la suite ».
  constraints.push(limit(boundedPageSize + 1));
  try {
    const snapshot = await getDocs(query(collection(db, "tasks"), ...constraints));
    diagnostics.deliveredDocuments += snapshot.size;
    if (snapshot.metadata?.fromCache) diagnostics.deliveredFromCache += snapshot.size;
    else diagnostics.lastServerSyncAt = new Date().toISOString();
    emitDiagnostics();
    const visibleDocuments = snapshot.docs.slice(0, boundedPageSize);
    return {
      items: visibleDocuments.map((item) => ({ id: item.id, ...item.data() })),
      cursor: visibleDocuments.at(-1) || null,
      hasMore: snapshot.docs.length > boundedPageSize,
      readCount: snapshot.size,
      source: snapshot.metadata?.fromCache ? "cache" : "server"
    };
  } catch (error) {
    recordClientError(error);
    throw error;
  }
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
  const unsubscribe = trackedOnSnapshot("personalActionItems", firstPageQuery, (snapshot) => {
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
  requireWritable();
  if (!profile?.uid || !["director", "admin"].includes(profile.role)) throw new Error("Profil requis pour mettre à jour cette décision.");
  if (!/^[A-Za-z0-9_-]{3,180}$/.test(String(actionItemId || ""))) throw new Error("Décision personnelle invalide.");
  const nextState = state === "done" ? "done" : "pending";
  const mutationId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const reference = doc(db, "actionItems", actionItemId);
  const archiveReference = doc(db, "changeArchive", `action-item-${mutationId}`.slice(0, 160));
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
    transaction.set(archiveReference, changeArchiveEntry("actionItem", actionItemId, "décision personnelle : " + nextState, {
      state: current.state || "pending"
    }, {
      state: nextState
    }, profile));
  });
  recordConfirmedWrites(2);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cockpit:action-item-state-saved", { detail: { id: actionItemId, state: nextState } }));
}

export async function updateCockpitFeedbackStatus(feedbackId, status, profile) {
  requireWritable();
  if (!profile || profile.role !== "admin") {
    throw new Error("Seule l’administration peut classer une rétroaction.");
  }
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(String(feedbackId || ""))) throw new Error("Rétroaction invalide.");
  if (!["open", "in_review", "done"].includes(status)) throw new Error("Statut de rétroaction invalide.");
  const reference = doc(db, "cockpitFeedback", feedbackId);
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error("Cette rétroaction n’existe plus.");
  const archiveReference = doc(collection(db, "changeArchive"));
  const batch = writeBatch(db);
  batch.update(reference, {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  });
  batch.set(archiveReference, changeArchiveEntry("cockpitFeedback", feedbackId, "rétroaction : " + status, { status: existing.data().status || "open" }, { status }, profile));
  await batch.commit();
  recordConfirmedWrites(2);
}

export function subscribeCockpitFeedback(callback, onError) {
  requireConfigured();
  const feedbackQuery = query(collection(db, "cockpitFeedback"), orderBy("createdAt", "desc"), limit(100));
  return trackedOnSnapshot(
    "cockpitFeedback",
    feedbackQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeAuditLogs(callback, onError) {
  requireConfigured();
  const logsQuery = query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(100));
  return trackedOnSnapshot(
    "auditLogs",
    logsQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}
