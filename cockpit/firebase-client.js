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
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
const config = globalThis.COCKPIT_FIREBASE_CONFIG || {};
const required = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
const roles = new Set(["director", "admin", "viewer"]);
export const MAX_ATTACHMENT_BYTES = 1024 * 1024;
const configured = required.every((key) => {
  const value = config[key];
  return typeof value === "string" && value.length > 0 && !value.includes("REMPLACER");
});

let app;
let auth;
let db;
let storage;
let persistenceState = "not-configured";
let storageState = "not-configured";

if (configured) {
  app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    persistenceState = "enabled";
  } catch {
    db = getFirestore(app);
    persistenceState = "unavailable";
  }
  try {
    storage = getStorage(app);
    storageState = "enabled";
  } catch {
    storageState = "unavailable";
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
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (!snapshot.exists()) return fallback;
    const profile = { ...fallback, ...snapshot.data(), uid: user.uid };
    return {
      ...profile,
      role: roles.has(profile.role) ? profile.role : "viewer",
      active: profile.active === true,
      displayLabel: String(profile.displayLabel || fallback.displayLabel).slice(0, 120)
    };
  } catch {
    return fallback;
  }
}

export function getClientState() {
  return { configured, persistenceState, storageState, auth, db, storage };
}

export async function fetchPrivateContent() {
  requireConfigured();
  const snapshot = await getDoc(doc(db, "privateContent", "plan"));
  if (!snapshot.exists()) {
    throw new Error("Le contenu sécurisé n’a pas encore été préparé.");
  }
  const data = snapshot.data();
  if (typeof data.html !== "string" || typeof data.css !== "string" || typeof data.script !== "string") {
    throw new Error("Le contenu sécurisé est incomplet.");
  }
  return data;
}

export function observeAuth(callback) {
  if (!configured) {
    callback(null, null, new Error("Firebase non configuré."));
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    callback(user, user ? await getProfile(user) : null, null);
  });
}

export async function signIn(email, password) {
  requireConfigured();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return getProfile(credential.user);
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

function requireStorage() {
  requireConfigured();
  if (!storage) throw new Error("Le stockage d’images Firebase n’est pas disponible.");
}

function validAttachmentId(value) {
  return /^[a-z0-9-]{3,80}$/i.test(String(value || ""));
}

export async function uploadImageAttachment({ eventId, blob, filename, width, height, originalName, originalWidth, originalHeight }, profile) {
  requireStorage();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Seuls les comptes de coordination peuvent ajouter un visuel.");
  }
  if (!validAttachmentId(eventId)) throw new Error("Événement invalide pour cette pièce jointe.");
  if (!(blob instanceof Blob) || blob.type !== "image/jpeg") {
    throw new Error("Le visuel doit être converti en JPEG avant son envoi.");
  }
  if (blob.size <= 0 || blob.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Le visuel optimisé doit rester sous 1 Mo.");
  }
  const attachmentRef = doc(collection(db, "attachments"));
  const safeName = String(filename || "visuel.jpg")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 90) || "visuel.jpg";
  const storagePath = `uploads/${eventId}/${attachmentRef.id}-${safeName.endsWith(".jpg") ? safeName : safeName + ".jpg"}`;
  const objectRef = storageRef(storage, storagePath);
  await uploadBytes(objectRef, blob, {
    contentType: "image/jpeg",
    customMetadata: {
      eventId: String(eventId),
      uploadedBy: String(profile.uid),
      conversionPreset: "meta-feed-4x5"
    }
  });
  const downloadUrl = await getDownloadURL(objectRef);
  const payload = {
    eventId: String(eventId),
    storagePath,
    filename: safeName,
    contentType: "image/jpeg",
    sizeBytes: blob.size,
    width: Number.isInteger(width) ? width : 1080,
    height: Number.isInteger(height) ? height : 1350,
    originalName: String(originalName || safeName).slice(0, 180),
    originalWidth: Number.isInteger(originalWidth) ? originalWidth : null,
    originalHeight: Number.isInteger(originalHeight) ? originalHeight : null,
    conversionPreset: "meta-feed-4x5",
    downloadedLocally: false,
    archived: false,
    createdByUid: profile.uid,
    createdByLabel: String(profile.displayLabel || "Utilisateur").slice(0, 120),
    createdAt: serverTimestamp()
  };
  await setDoc(attachmentRef, payload);
  await appendChangeArchive("attachment", attachmentRef.id, "visuel optimisé ajouté", {}, {
    eventId: payload.eventId,
    filename: payload.filename,
    sizeBytes: payload.sizeBytes,
    width: payload.width,
    height: payload.height,
    conversionPreset: payload.conversionPreset
  }, profile);
  return { id: attachmentRef.id, ...payload, downloadUrl };
}

export function subscribeImageAttachments(callback, onError) {
  requireConfigured();
  const attachmentsQuery = query(collection(db, "attachments"), orderBy("createdAt", "desc"), limit(500));
  return onSnapshot(
    attachmentsQuery,
    (snapshot) => {
      Promise.all(snapshot.docs.map(async (item) => {
        const data = item.data();
        let downloadUrl = null;
        try {
          if (data.storagePath) downloadUrl = await getDownloadURL(storageRef(storage, data.storagePath));
        } catch (error) {
          console.warn("URL de visuel indisponible", item.id, error);
        }
        return { id: item.id, ...data, downloadUrl };
      })).then(callback).catch(onError);
    },
    onError
  );
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
  const reference = await addDoc(collection(db, "comments"), {
    sectionId: itemId,
    comment: text.slice(0, 5000),
    quickTag,
    dictated: Boolean(dictated),
    authorUid: profile.uid,
    createdAt: serverTimestamp()
  });
  await appendChangeArchive("comment", reference.id, dictated ? "commentaire dicté" : "commentaire ajouté", {}, {
    sectionId: itemId,
    comment: text,
    quickTag: quickTag || null,
    dictated: Boolean(dictated)
  }, profile);
  return reference.id;
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
