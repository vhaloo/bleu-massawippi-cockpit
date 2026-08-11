import fs from "node:fs/promises";
import process from "node:process";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch } from "firebase/firestore";

const projectId = "cockpit-media-decision-test";
const [host = "127.0.0.1", portText = "8187"] = String(process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8187").split(":");
const rules = await fs.readFile(new URL("./firestore.rules", import.meta.url), "utf8");
const environment = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(portText), rules } });

const ids = {
  admin: "valentin-media-rules",
  director: "annie-media-rules",
  viewer: "viewer-media-rules",
  event: "alt-20260801",
  historical: "history-alt-20260801-aerial",
  current: "history-alt-20260801-aerial-current-2024",
  blocked: "history-alt-20260801-blocked",
  unblockedRights: "history-alt-20260801-unblocked-rights",
  foreign: "history-foreign-event",
  legacyEvent: "barbotte-20260730-signalement",
  legacyMedia: "editorial-barbotte-20260806-tumeurs-usgs-v3",
  legacyBlocked: "editorial-barbotte-20260806-blocked",
  legacyArchived: "editorial-barbotte-20260806-archived"
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

const uncertainMedia = () => ({
  ...media(ids.event, false, true),
  rightsStatus: "photographie interne — autorisation à confirmer"
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
    await setDoc(doc(db, "users", ids.viewer), { role: "viewer", active: true, displayLabel: "Lecture seule" });
    await setDoc(doc(db, "workflowStates", ids.event), workflow(ids.admin, "Valentin", "content_approved"));
    await setDoc(doc(db, "mediaLinks", ids.historical), media());
    await setDoc(doc(db, "mediaLinks", ids.current), media());
    await setDoc(doc(db, "mediaLinks", ids.blocked), media(ids.event, false, true));
    await setDoc(doc(db, "mediaLinks", `${ids.blocked}-rights`), uncertainMedia());
    await setDoc(doc(db, "mediaLinks", ids.unblockedRights), { ...uncertainMedia(), publicationBlocked: false });
    await setDoc(doc(db, "mediaLinks", ids.foreign), media("other-event"));
    await setDoc(doc(db, "workflowStates", ids.legacyEvent), {
      eventId: ids.legacyEvent,
      stage: "media_review",
      updatedAt: now(),
      updatedBy: ids.admin,
      updatedByLabel: "Valentin"
    });
    await setDoc(doc(db, "mediaLinks", ids.legacyMedia), media(ids.legacyEvent));
    await setDoc(doc(db, "mediaLinks", ids.legacyBlocked), media(ids.legacyEvent, false, true));
    await setDoc(doc(db, "mediaLinks", ids.legacyArchived), media(ids.legacyEvent, true, false));
    await setDoc(doc(db, "mediaDecisions", ids.legacyEvent), {
      eventId: ids.legacyEvent,
      schemaVersion: 2,
      communications: emptySide("admin"),
      direction: emptySide("director"),
      // Reproduit exactement l'ancien format présent en production le 4 août.
      override: { ...emptyOverride(), actorRole: "admin" },
      agreement: { status: "pending", mediaIds: [], divergent: false },
      textGateStage: "proposal",
      lastMutationId: "editorial-cycle-20260801-barbotte-reset",
      updatedAt: now(),
      updatedBy: ids.admin,
      updatedByLabel: "Valentin"
    });
  });

  const adminDb = environment.authenticatedContext(ids.admin).firestore();
  const directorDb = environment.authenticatedContext(ids.director).firestore();
  const viewerDb = environment.authenticatedContext(ids.viewer).firestore();
  const pair = [ids.historical, ids.current].sort();

  const rightsBatch = writeBatch(directorDb);
  rightsBatch.update(doc(directorDb, "mediaLinks", `${ids.blocked}-rights`), {
    publicationBlocked: false,
    rightsConfirmed: true,
    rightsConfirmedAt: now(),
    rightsConfirmedBy: ids.director,
    rightsConfirmedByLabel: "Annie",
    updatedAt: now(),
    updatedBy: ids.director
  });
  rightsBatch.set(doc(directorDb, "changeArchive", "rights-confirmation-test"), {
    entityType: "mediaLink",
    entityId: `${ids.blocked}-rights`,
    action: "droits de diffusion confirmés",
    before: { rightsConfirmed: false, publicationBlocked: true },
    after: { rightsConfirmed: true, publicationBlocked: false },
    actorUid: ids.director,
    actorLabel: "Annie",
    createdAt: now()
  });
  await check("la direction confirme les droits avec une archive atomique", rightsBatch.commit());
  const rightsConfirmedMedia = (await getDoc(doc(directorDb, "mediaLinks", `${ids.blocked}-rights`))).data();
  assert.equal(rightsConfirmedMedia.publicationBlocked, false);
  assert.equal(rightsConfirmedMedia.rightsConfirmed, true);
  await check("la direction remet les droits en attente avant tout choix média", updateDoc(doc(directorDb, "mediaLinks", `${ids.blocked}-rights`), {
    publicationBlocked: true,
    rightsConfirmed: false,
    rightsConfirmedAt: null,
    rightsConfirmedBy: "",
    rightsConfirmedByLabel: "",
    updatedAt: now(),
    updatedBy: ids.director
  }));
  await check("la direction reconfirme les droits avant le choix média", updateDoc(doc(directorDb, "mediaLinks", `${ids.blocked}-rights`), {
    publicationBlocked: false,
    rightsConfirmed: true,
    rightsConfirmedAt: now(),
    rightsConfirmedBy: ids.director,
    rightsConfirmedByLabel: "Annie",
    updatedAt: now(),
    updatedBy: ids.director
  }));

  const adminRightsBatch = writeBatch(adminDb);
  adminRightsBatch.update(doc(adminDb, "mediaLinks", ids.unblockedRights), {
    publicationBlocked: false,
    rightsConfirmed: true,
    rightsConfirmedAt: now(),
    rightsConfirmedBy: ids.admin,
    rightsConfirmedByLabel: "Valentin",
    updatedAt: now(),
    updatedBy: ids.admin
  });
  adminRightsBatch.set(doc(adminDb, "changeArchive", "rights-confirmation-admin-unblocked-test"), {
    entityType: "mediaLink",
    entityId: ids.unblockedRights,
    action: "droits de diffusion confirmés",
    before: { rightsConfirmed: false, publicationBlocked: false },
    after: { rightsConfirmed: true, publicationBlocked: false },
    actorUid: ids.admin,
    actorLabel: "Valentin",
    createdAt: now()
  });
  await check("les communications confirment un média historique déjà non bloqué", adminRightsBatch.commit());
  await check("un rôle en lecture seule ne peut pas remettre les droits en attente", updateDoc(doc(viewerDb, "mediaLinks", ids.unblockedRights), {
    publicationBlocked: true,
    rightsConfirmed: false,
    rightsConfirmedAt: null,
    rightsConfirmedBy: "",
    rightsConfirmedByLabel: "",
    updatedAt: now(),
    updatedBy: ids.viewer
  }), false);
  await check("les communications peuvent remettre leurs droits en attente", updateDoc(doc(adminDb, "mediaLinks", ids.unblockedRights), {
    publicationBlocked: true,
    rightsConfirmed: false,
    rightsConfirmedAt: null,
    rightsConfirmedBy: "",
    rightsConfirmedByLabel: "",
    updatedAt: now(),
    updatedBy: ids.admin
  }));

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

  const reopenedDecision = {
    ...agreedDecision,
    agreement: { status: "pending", mediaIds: [], divergent: false },
    textGateStage: "content_review",
    lastMutationId: `reopen-copy-${Date.now()}`,
    updatedAt: now(),
    updatedBy: ids.admin,
    updatedByLabel: "Valentin"
  };
  const reopenBatch = writeBatch(adminDb);
  reopenBatch.set(doc(adminDb, "mediaDecisions", ids.event), reopenedDecision);
  reopenBatch.set(doc(adminDb, "workflowStates", ids.event), workflow(ids.admin, "Valentin", "content_review"));
  await check("les communications rouvrent un texte révisé sans perdre les deux choix média", reopenBatch.commit());

  const reapprovedDecision = {
    ...reopenedDecision,
    agreement: { status: "agreed", mediaIds: pair, divergent: false },
    textGateStage: "final_approved",
    lastMutationId: `reapprove-copy-${Date.now()}`,
    updatedAt: now(),
    updatedBy: ids.director,
    updatedByLabel: "Annie"
  };
  const reapproveBatch = writeBatch(directorDb);
  reapproveBatch.set(doc(directorDb, "mediaDecisions", ids.event), reapprovedDecision);
  reapproveBatch.set(doc(directorDb, "workflowStates", ids.event), workflow(ids.director, "Annie", "final_approved"));
  await check("la nouvelle approbation du texte réactive l’accord média conservé", reapproveBatch.commit());

  const directorBatch = writeBatch(directorDb);
  directorBatch.set(doc(directorDb, "workflowStates", ids.event), workflow(ids.director, "Annie", "media_review"));
  directorBatch.set(doc(directorDb, "mediaDecisions", ids.event), {
    eventId: ids.event,
    schemaVersion: 2,
    communications: reapprovedDecision.communications,
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

  const legacyChoice = {
    eventId: ids.legacyEvent,
    schemaVersion: 2,
    communications: selectedSide(ids.admin, "Valentin", "admin", [ids.legacyMedia]),
    direction: emptySide("director"),
    override: emptyOverride(),
    agreement: { status: "pending", mediaIds: [], divergent: false },
    textGateStage: "media_review",
    lastMutationId: `legacy-choose-${Date.now()}`,
    updatedAt: now(),
    updatedBy: ids.admin,
    updatedByLabel: "Valentin"
  };
  await check("les communications choisissent un média malgré l’ancien override inactif", setDoc(doc(adminDb, "mediaDecisions", ids.legacyEvent), legacyChoice));

  const legacyRevoked = {
    ...legacyChoice,
    communications: {
      status: "revoked",
      mediaIds: [],
      actorUid: ids.admin,
      actorLabel: "Valentin",
      actorRole: "admin",
      decidedAt: now()
    },
    lastMutationId: `legacy-revoke-${Date.now()}`,
    updatedAt: now()
  };
  await check("les communications retirent leur choix de façon réversible", setDoc(doc(adminDb, "mediaDecisions", ids.legacyEvent), legacyRevoked));

  await check("les communications peuvent rechoisir le même média", setDoc(doc(adminDb, "mediaDecisions", ids.legacyEvent), {
    ...legacyChoice,
    lastMutationId: `legacy-reselect-${Date.now()}`,
    updatedAt: now()
  }));
  await check("un média bloqué reste impossible à choisir", setDoc(doc(adminDb, "mediaDecisions", ids.legacyEvent), {
    ...legacyChoice,
    communications: selectedSide(ids.admin, "Valentin", "admin", [ids.legacyBlocked]),
    lastMutationId: `legacy-blocked-${Date.now()}`,
    updatedAt: now()
  }), false);
  await check("un média archivé reste impossible à choisir", setDoc(doc(adminDb, "mediaDecisions", ids.legacyEvent), {
    ...legacyChoice,
    communications: selectedSide(ids.admin, "Valentin", "admin", [ids.legacyArchived]),
    lastMutationId: `legacy-archived-${Date.now()}`,
    updatedAt: now()
  }), false);

  console.log(`✓ ${checks.length} scénarios de règles de sélection multiple vérifiés.`);
} finally {
  await environment.cleanup();
}
