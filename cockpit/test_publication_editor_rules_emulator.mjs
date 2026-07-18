import fs from "node:fs/promises";
import process from "node:process";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  writeBatch
} from "firebase/firestore";

const projectId = "cockpit-publication-editor-test";
const [host = "127.0.0.1", portText = "8187"] = String(process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8187").split(":");
const rules = await fs.readFile(new URL("./firestore.rules", import.meta.url), "utf8");
const environment = await initializeTestEnvironment({
  projectId,
  firestore: { host, port: Number(portText), rules }
});

const ids = {
  admin: "valentin-editor-test",
  director: "annie-editor-test",
  viewer: "viewer-editor-test",
  publication: "pub-20260730-rules-test",
  directorPublication: "pub-20260731-director-denied"
};

const now = Timestamp.now();
const editorial = (revision = 1) => ({
  revision,
  theme: "Éducation",
  week: 3,
  tier: "Pilier",
  visual: "Photo réelle autorisée ou affiche naturaliste.",
  copy: "FR — Texte français vérifié.\n\nEN — Verified English copy.",
  fallback: "Composition typographique sobre.",
  kpi: "Enregistrements",
  task: "Vérifier la source et les droits.",
  choiceRequired: false,
  optionGroup: "",
  optionLabel: "",
  isAlternative: false,
  archivedEditorial: false,
  originId: "",
  templateId: "educational",
  createdBy: ids.admin,
  createdAt: now
});

const schedule = (uid, revision = 1) => ({
  title: "Une publication de test",
  dateKey: "Jeudi 30 juillet 2026",
  dateIso: "2026-07-30",
  format: "Affiche éducative + légende bilingue",
  role: "Tester le Studio sans toucher à la production.",
  cta: "Découvrir avec nous",
  source: "Source primaire",
  tasksValentin: ["Finaliser le texte."],
  tasksAnnie: ["Confirmer le fait sensible."],
  calendarTime: "08:00",
  calendarDurationMinutes: 30,
  calendarLocation: "",
  calendarCost: "Gratuit",
  status: "pending",
  deleted: false,
  selected: true,
  editorial: editorial(revision),
  updatedAt: now,
  updatedBy: uid
});

const archive = (uid, id, action = "publication créée") => ({
  entityType: "publicationContent",
  entityId: id,
  action,
  before: {},
  after: { title: "Une publication de test", editorial: { revision: 1 } },
  actorUid: uid,
  actorLabel: uid === ids.admin ? "Valentin — Communications" : "Annie — Direction",
  createdAt: now
});

const results = [];
async function check(label, promise, shouldSucceed = true) {
  await (shouldSucceed ? assertSucceeds(promise) : assertFails(promise));
  results.push(`✓ ${label}`);
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
  const publicationRef = doc(adminDb, "scheduleItems", ids.publication);

  const createBatch = writeBatch(adminDb);
  createBatch.set(publicationRef, schedule(ids.admin, 1));
  createBatch.set(doc(adminDb, "changeArchive", "create-v1"), archive(ids.admin, ids.publication));
  await check("admin crée une publication et son archive dans le même lot", createBatch.commit());

  await check("direction lit la publication", getDoc(doc(directorDb, "scheduleItems", ids.publication)));
  await check("compte lecture lit la publication", getDoc(doc(viewerDb, "scheduleItems", ids.publication)));
  await check("direction ne lit pas l’historique admin", getDoc(doc(directorDb, "changeArchive", "create-v1")), false);
  await check("admin lit l’historique", getDoc(doc(adminDb, "changeArchive", "create-v1")));

  const directorCreate = schedule(ids.director, 1);
  directorCreate.editorial.createdBy = ids.director;
  await check(
    "direction ne crée pas de contenu Studio",
    setDoc(doc(directorDb, "scheduleItems", ids.directorPublication), directorCreate),
    false
  );

  const currentAfterCreate = (await getDoc(publicationRef)).data();
  await check(
    "direction ne modifie pas le contenu éditorial",
    setDoc(doc(directorDb, "scheduleItems", ids.publication), {
      ...currentAfterCreate,
      title: "Titre interdit",
      editorial: { ...currentAfterCreate.editorial, revision: 2 },
      updatedAt: Timestamp.now(),
      updatedBy: ids.director
    }),
    false
  );

  await check(
    "admin ne saute pas une révision",
    setDoc(publicationRef, {
      ...currentAfterCreate,
      editorial: { ...currentAfterCreate.editorial, revision: 3 },
      updatedAt: Timestamp.now(),
      updatedBy: ids.admin
    }),
    false
  );

  const updateBatch = writeBatch(adminDb);
  const version2 = {
    ...currentAfterCreate,
    title: "Une publication de test révisée",
    editorial: { ...currentAfterCreate.editorial, revision: 2 },
    updatedAt: Timestamp.now(),
    updatedBy: ids.admin
  };
  updateBatch.set(publicationRef, version2);
  updateBatch.set(doc(adminDb, "changeArchive", "update-v2"), archive(ids.admin, ids.publication, "publication modifiée"));
  await check("admin crée une révision séquentielle et son archive", updateBatch.commit());

  const currentAfterUpdate = (await getDoc(publicationRef)).data();
  await check(
    "direction conserve ses changements opérationnels",
    setDoc(doc(directorDb, "scheduleItems", ids.publication), {
      ...currentAfterUpdate,
      status: "needs_work",
      updatedAt: Timestamp.now(),
      updatedBy: ids.director
    }),
    true
  );

  await check("aucun rôle ne supprime une publication", deleteDoc(publicationRef), false);
  console.log(results.join("\n"));
  console.log(`✓ ${results.length} scénarios de règles Studio vérifiés dans l’émulateur.`);
} finally {
  await environment.cleanup();
}
