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
  enableIndexedDbPersistence,
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

if (configured) {
  app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {
    persistenceState = "unavailable";
  });

  enableIndexedDbPersistence(db).then(() => {
    persistenceState = "enabled";
  }).catch((error) => {
    persistenceState = error?.code === "failed-precondition" ? "another-tab" : "unavailable";
  });
}

function requireConfigured() {
  if (!configured) {
    throw new Error("Firebase n’est pas configuré. Renseignez firebase-config.js.");
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
  return { configured, persistenceState, auth, db };
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
  await setDoc(doc(db, "scheduleItems", itemId), {
    ...payload,
    deleted: payload.status === "deleted",
    updatedAt: serverTimestamp(),
    updatedBy: profile.uid
  }, { merge: true });
}

export async function setScheduleSelection(itemId, groupIds, selected, profile) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’arbitrer le calendrier.");
  }
  const ids = [...new Set([itemId, ...(Array.isArray(groupIds) ? groupIds : [])])]
    .filter((id) => /^[a-z0-9-]{3,80}$/i.test(String(id)));
  if (!ids.includes(itemId)) throw new Error("Groupe de choix invalide.");
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, "scheduleItems", id), {
      selected: Boolean(selected) && id === itemId,
      updatedAt: serverTimestamp(),
      updatedBy: profile.uid
    });
  }
  await batch.commit();
}

export async function addComment(itemId, comment, profile, quickTag = null, dictated = false) {
  requireConfigured();
  if (!profile || !["director", "admin"].includes(profile.role)) {
    throw new Error("Ce compte n’a pas le droit d’ajouter un commentaire.");
  }
  const text = String(comment || "").trim();
  if (!text) return;
  await addDoc(collection(db, "comments"), {
    sectionId: itemId,
    comment: text.slice(0, 5000),
    quickTag,
    dictated: Boolean(dictated),
    authorUid: profile.uid,
    createdAt: serverTimestamp()
  });
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
  await addDoc(collection(db, "cockpitFeedback"), {
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
