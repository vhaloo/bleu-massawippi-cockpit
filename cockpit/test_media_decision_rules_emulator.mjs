import fs from "node:fs/promises";
import process from "node:process";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, writeBatch } from "firebase/firestore";

const projectId = "cockpit-media-decision-test";
const [host = "127.0.0.1", portText = "8187"] = String(process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8187").split(":");
const rules = await fs.readFile(new URL("./firestore.rules", import.meta.url), "utf8");
const environment = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(portText), rules } });

const ids = {
  admin: "valentin-media-rules",
  director: "annie-media-rules",
  event: "alt-20260801",
  historical: "history-alt-20260801-aerial",
  current: "history-alt-20260801-aerial-current-2024",
  blocked: "history-alt-20260801-blocked",
  foreign: "history-foreign-event"
};

const now = () => Timestamp.now();
const emptySide = (role) => ({ status: "none", mediaIds: [], actorUid: "", actorLabel: "", actorRole: role, decidedAt: null });
const selectedSide = (uid, label, role, mediaIds) => ({ status: "selected", mediaIds: [...mediaIds].sort(), actorUid: uid, actorLabel: label, actorRole: role, decidedAt: now() });
const emptyOverride = () => ({ active: false, mediaIds: [], reason: "", actorUid: "", actorLabel: "", actorRole: "", decidedAt: null });
const workflow = (uid, label, stage) => ({ eventId: ids.event, stage, updatedAt: now(), updatedBy: uid, updatedByLabel: label });
const media = (eventId = ids.event, archived = false, publicationBlocked = false) => ({
  eventId,
  label: "Média de recette",
  url: "https://bleumassawippi.sharepoint.com/:i:/g/recette",
  kind: "image",
  stage: "proposal",
  note: "Recette locale des règles de sélection multiple.",
  archived,
  publicationBlocked,
  authorUid: ids.admin,
  authorLabel: "Valentin",
  createdAt: now(),
  updatedAt: now(),
  updatedBy: ids.admin
});

const pendingDecision = (directionIds) => ({
  eventId: ids.event,
  schemaVersion: 2,
  communications: emptySide("admin"),
  direction: selectedSide(ids.director, "Annie", "director", directionIds),
  override: emptyOverride(),
  agreement: { status: "pending", mediaIds: [], divergent: false },
  textGateStage: "content_approved",
  lastMutationId: `direction-${Date.now()}`,
  updatedAt: now(),
  updatedBy: ids.director,
  updatedByLabel: "Annie"
});

const checks = [];
async function check(label, promise, succeeds = true) {
  console.log(`→ ${label}`);
  await (succeeds ? assertSucceeds(promise) : assertFails(promise));
  checks.push(label);
}

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", ids.admin), { role: "admin", active: true, displayLabel: "Valentin" });
    await setDoc(doc(db, "users", ids.director), { role: "director", active: true, displayLabel: "Annie" });
    await setDoc(doc(db, "workflowStates", ids.event), workflow(ids.admin, "Valentin", "content_approved"));
    await setDoc(doc(db, "mediaLinks", ids.historical), media());
    await setDoc(doc(db, "mediaLinks", ids.current), media());
    await setDoc(doc(db, "mediaLinks", ids.blocked), media(ids.event, false, true));
    await setDoc(doc(db, "mediaLinks", ids.foreign), media("other-event"));
  });

  const adminDb = environment.authenticatedContext(ids.admin).firestore();
  const directorDb = environment.authenticatedContext(ids.director).firestore();
  const pair = [ids.historical, ids.current].sort();

  await check("la direction choisit les deux cartes du carrousel", setDoc(doc(directorDb, "mediaDecisions", ids.event), pendingDecision(pair)));
  const initialDecision = (await getDoc(doc(directorDb, "mediaDecisions", ids.event))).data();
  await check("un média bloqué ne peut pas entrer dans le carrousel", setDoc(doc(directorDb, "mediaDecisions", "blocked-attempt"), { ...pendingDecision([ids.blocked]), eventId: "blocked-attempt", lastMutationId: "blocked-attempt" }), false);
  await check("un média d’un autre événement est refusé", setDoc(doc(directorDb, "mediaDecisions", "foreign-attempt"), { ...pendingDecision([ids.foreign]), eventId: "foreign-attempt", lastMutationId: "foreign-attempt" }), false);
  await check("plus de deux médias sont refusés", setDoc(doc(directorDb, "mediaDecisions", "too-many"), { ...pendingDecision(["a-media", "b-media", "c-media"]), eventId: "too-many", lastMutationId: "too-many" }), false);

  const agreedDecision = {
    ...pendingDecision(pair),
    communications: selectedSide(ids.admin, "Valentin", "admin", pair),
    direction: initialDecision.direction,
    agreement: { status: "agreed", mediaIds: pair, divergent: false },
    textGateStage: "content_approved",
    lastMutationId: `agreement-${Date.now()}`,
    updatedAt: now(),
    updatedBy: ids.admin,
    updatedByLabel: "Valentin"
  };
  const adminBatch = writeBatch(adminDb);
  adminBatch.set(doc(adminDb, "mediaDecisions", ids.event), agreedDecision);
  adminBatch.set(doc(adminDb, "workflowStates", ids.event), workflow(ids.admin, "Valentin", "final_approved"));
  await check("le même duo donne l’accord final et avance le workflow atomiquement", adminBatch.commit());

  const directorBatch = writeBatch(directorDb);
  directorBatch.set(doc(directorDb, "workflowStates", ids.event), workflow(ids.director, "Annie", "media_review"));
  directorBatch.set(doc(directorDb, "mediaDecisions", ids.event), {
    eventId: ids.event,
    schemaVersion: 2,
    communications: agreedDecision.communications,
    direction: selectedSide(ids.director, "Annie", "director", [ids.historical]),
    override: emptyOverride(),
    agreement: { status: "divergent", mediaIds: [], divergent: true },
    textGateStage: "final_approved",
    lastMutationId: `remove-${Date.now()}`,
    updatedAt: now(),
    updatedBy: ids.director,
    updatedByLabel: "Annie"
  });
  await check("la direction retire une carte et rouvre le visuel atomiquement", directorBatch.commit());

  console.log(`✓ ${checks.length} scénarios de règles de sélection multiple vérifiés.`);
} finally {
  await environment.cleanup();
}
