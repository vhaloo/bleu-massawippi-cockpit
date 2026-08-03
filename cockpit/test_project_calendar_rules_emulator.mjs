import fs from "node:fs/promises";
import process from "node:process";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, Timestamp } from "firebase/firestore";

const projectId = "cockpit-project-calendar-test";
const [host = "127.0.0.1", portText = "8187"] = String(process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8187").split(":");
const rules = await fs.readFile(new URL("./firestore.rules", import.meta.url), "utf8");
const environment = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(portText), rules } });
const ids = { admin: "valentin-project-calendar", director: "annie-project-calendar", viewer: "viewer-project-calendar", proposal: "proposal-calendar-test", event: "project-calendar-event-test" };
const now = Timestamp.now();

const proposal = (uid = ids.director, role = "director") => ({
  schemaVersion: 1,
  title: "Une rencontre à préparer",
  description: "La date est connue; les détails suivront.",
  startDate: "2026-08-10",
  endDate: "2026-08-12",
  dateMode: "range",
  category: "meeting",
  urgency: "important",
  projectId: "poesie-du-lac",
  attachmentUrl: "https://bleumassawippi.sharepoint.com/:f:/g/exemple",
  attachmentLocation: "Media Cockpit / Poésie",
  notes: "Horaire à confirmer.",
  status: "submitted",
  convertedEventId: "",
  authorUid: uid,
  authorRole: role,
  authorLabel: uid === ids.director ? "Annie" : "Valentin",
  createdAt: now,
  updatedAt: now,
  updatedBy: uid
});

const calendarEvent = (uid = ids.admin) => ({
  schemaVersion: 1,
  eventId: ids.event,
  title: "Au bord du bleu",
  summary: "Rencontre de poésie, prose et slam.",
  startDate: "2026-08-30",
  endDate: "2026-08-30",
  dateMode: "single",
  startTime: "13:00",
  endTime: "16:00",
  allDay: false,
  category: "field_activity",
  urgency: "important",
  stage: "confirmed",
  projectId: "poesie-du-lac",
  sourceProposalId: ids.proposal,
  attachmentUrl: "",
  attachmentLabel: "",
  actionUrl: "https://forms.office.com/r/4A2xsMh7st",
  actionLabel: "Formulaire",
  location: "Parc Lôbadanaki",
  ownerLabel: "Bleu Massawippi",
  createdAt: now,
  updatedAt: now,
  updatedBy: uid,
  updatedByLabel: "Valentin"
});

const checked = [];
async function check(label, promise, succeeds = true) {
  await (succeeds ? assertSucceeds(promise) : assertFails(promise));
  checked.push(label);
}

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", ids.admin), { role: "admin", active: true, displayLabel: "Valentin" });
    await setDoc(doc(db, "users", ids.director), { role: "director", active: true, displayLabel: "Annie" });
    await setDoc(doc(db, "users", ids.viewer), { role: "viewer", active: true, displayLabel: "Lecture" });
  });
  const adminDb = environment.authenticatedContext(ids.admin).firestore();
  const directorDb = environment.authenticatedContext(ids.director).firestore();
  const viewerDb = environment.authenticatedContext(ids.viewer).firestore();

  await check("direction crée sa proposition", setDoc(doc(directorDb, "projectEventProposals", ids.proposal), proposal()));
  await check("compte lecture lit une proposition", getDoc(doc(viewerDb, "projectEventProposals", ids.proposal)));
  await check("liste bornée des propositions", getDocs(query(collection(directorDb, "projectEventProposals"), orderBy("createdAt", "desc"), limit(30))));
  await check("liste non bornée refusée", getDocs(collection(directorDb, "projectEventProposals")), false);
  await check("compte lecture ne crée pas de proposition", setDoc(doc(viewerDb, "projectEventProposals", "viewer-proposal"), proposal(ids.viewer, "viewer")), false);
  await check("lien de pièce jointe externe refusé", setDoc(doc(directorDb, "projectEventProposals", "bad-link-proposal"), { ...proposal(), attachmentUrl: "https://example.com/file.pdf" }), false);

  const current = (await getDoc(doc(directorDb, "projectEventProposals", ids.proposal))).data();
  await check("direction corrige sa proposition encore nouvelle", setDoc(doc(directorDb, "projectEventProposals", ids.proposal), { ...current, description: "Description précisée.", updatedAt: Timestamp.now(), updatedBy: ids.director }));
  const corrected = (await getDoc(doc(adminDb, "projectEventProposals", ids.proposal))).data();
  await check("communications place la proposition en préparation", setDoc(doc(adminDb, "projectEventProposals", ids.proposal), { ...corrected, status: "in_review", updatedAt: Timestamp.now(), updatedBy: ids.admin }));
  const inReview = (await getDoc(doc(directorDb, "projectEventProposals", ids.proposal))).data();
  await check("proposition en préparation n’est plus réécrite par son auteur", setDoc(doc(directorDb, "projectEventProposals", ids.proposal), { ...inReview, notes: "Modification tardive", updatedAt: Timestamp.now(), updatedBy: ids.director }), false);
  await check("aucun rôle ne supprime la proposition", deleteDoc(doc(adminDb, "projectEventProposals", ids.proposal)), false);

  await check("communications crée l’événement formel", setDoc(doc(adminDb, "projectCalendarEvents", ids.event), calendarEvent()));
  await check("direction lit l’événement formel", getDoc(doc(directorDb, "projectCalendarEvents", ids.event)));
  await check("direction ne crée pas l’événement formel", setDoc(doc(directorDb, "projectCalendarEvents", "director-event"), { ...calendarEvent(ids.director), eventId: "director-event", updatedByLabel: "Annie" }), false);
  await check("liste bornée des événements", getDocs(query(collection(viewerDb, "projectCalendarEvents"), orderBy("endDate", "asc"), limit(120))));
  await check("aucun rôle ne supprime l’événement", deleteDoc(doc(adminDb, "projectCalendarEvents", ids.event)), false);

  console.log(`✓ ${checked.length} scénarios de règles du calendrier de projets vérifiés.`);
} finally {
  await environment.cleanup();
}
