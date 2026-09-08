import assert from "node:assert/strict";
import { draftForCommand, parseArgs, saveDraft } from "./publication_editor_cli.mjs";
import { schedulePayloadFromDraft } from "./publication-editor-schema.mjs";

// No credentials, emulator or production calls: exercise the actual command writer
// with an atomic in-memory transaction. Late changes simulate a concurrent user.
const draft = { id: "test-publication", title: "Le lac", dateIso: "2026-09-12", copy: "FR — Le lac nous rassemble.\n\nEN — The lake brings us together." };
const row = schedulePayloadFromDraft(draft);
function database(initial = {}, beforeTransaction) {
  const records = new Map(Object.entries(initial));
  const writes = [];
  const snapshot = key => ({ id: key.split("/").at(-1), exists: records.has(key), data: () => records.get(key) });
  const db = {
    records, writes, transactionReads: [],
    collection(name) { return { doc(id) { const key = `${name}/${id}`; return { path: key, get: async () => snapshot(key) }; } }; },
    async runTransaction(callback) {
      beforeTransaction?.(records);
      const pending = [];
      const result = await callback({
        get: async ref => { assert.equal(pending.length, 0, "all reads precede writes"); db.transactionReads.push(ref.path); return snapshot(ref.path); },
        set: (ref, value, options) => pending.push({ path: ref.path, value, options })
      });
      for (const write of pending) { records.set(write.path, { ...(write.options?.merge ? records.get(write.path) : {}), ...write.value }); writes.push(write); }
      return result;
    }
  };
  return db;
}
const initial = (workflow = {}, schedule = {}) => ({
  "scheduleItems/test-publication": { ...row, ...schedule },
  "workflowStates/test-publication": workflow,
  "users/test-admin": { active: true, role: "admin", displayLabel: "Test" }
});
const args = apply => parseArgs(["update", ...(apply ? ["--apply", "--actor-uid", "test-admin"] : [])]);
let passed = 0;
async function check(label, run) { await run(); passed++; console.log(`✓ ${label}`); }

await check("simulation et application bloquent tous les états terminés sans écriture", async () => {
  for (const apply of [false, true]) for (const stage of ["scheduled", "published", "completed", "done", " PUBLISHED "]) {
    const db = database(initial({ stage }));
    await assert.rejects(saveDraft(db, draft, args(apply), "test"), /mutation refusée/);
    assert.equal(db.writes.length, 0);
  }
});
await check("les anciens drapeaux de fin de publication sont également protégés", async () => {
  for (const schedule of [{ scheduled: true }, { published: true }, { completed: true }, { status: "done" }]) {
    const db = database(initial({}, schedule));
    await assert.rejects(saveDraft(db, draft, args(true), "test"), /mutation refusée/);
    assert.equal(db.writes.length, 0);
  }
});
await check("publication programmée après la lecture préliminaire : transaction refusée", async () => {
  const db = database(initial(), data => data.set("workflowStates/test-publication", { stage: "scheduled" }));
  await assert.rejects(saveDraft(db, draft, args(true), "test"), /mutation refusée/);
  assert(db.transactionReads.includes("workflowStates/test-publication")); assert.equal(db.writes.length, 0);
});
await check("changement tardif du statut historique : transaction refusée", async () => {
  const db = database(initial(), data => data.set("scheduleItems/test-publication", { ...row, published: true }));
  await assert.rejects(saveDraft(db, draft, args(true), "test"), /mutation refusée/); assert.equal(db.writes.length, 0);
});
await check("simulation autorisée n’écrit rien et conserve la version", async () => {
  const db = database(initial({ stage: "final_approved" }));
  const before = db.records.get("scheduleItems/test-publication");
  const result = await saveDraft(db, draft, args(false), "test");
  assert.equal(result.mode, "dry-run"); assert.equal(db.writes.length, 0); assert.equal(db.records.get("scheduleItems/test-publication"), before);
});
await check("brouillon modifié et archive dans la même transaction, champs opérationnels conservés", async () => {
  const db = database(initial({}, { selected: true, status: "pending" }));
  const before = db.records.get("scheduleItems/test-publication");
  const result = await saveDraft(db, { ...draft, title: "Le lac, ensemble" }, args(true), "test");
  assert.equal(result.writes, 2); assert.equal(db.writes.length, 2);
  const after = db.records.get("scheduleItems/test-publication");
  assert.equal(after.selected, true); assert.equal(after.status, "pending"); assert.equal(after.editorial.revision, row.editorial.revision + 1);
  const archive = db.writes.find(w => w.path.startsWith("changeArchive/")); assert.deepEqual(archive.value.before, before); assert.equal(archive.value.after.title, "Le lac, ensemble");
});
await check("version périmée refusée dès la simulation, conflit tardif refusé aussi", async () => {
  const stale = args(false); stale.values.set("expected-revision", "0");
  await assert.rejects(saveDraft(database(initial()), draft, stale, "test"), /Conflit de révision/);
  const db = database(initial(), data => data.set("scheduleItems/test-publication", { ...row, editorial: { ...row.editorial, revision: 99 } }));
  await assert.rejects(saveDraft(db, draft, args(true), "test"), /Conflit de révision/); assert.equal(db.writes.length, 0);
});
await check("duplication d’une publication terminée : original intact, aucune validation copiée", async () => {
  const db = database(initial({ stage: "published" }));
  const original = db.records.get("scheduleItems/test-publication");
  const duplicateArgs = parseArgs(["duplicate", "--id", draft.id, "--date", "2026-09-20", "--new-id", "test-copy", "--apply", "--actor-uid", "test-admin"]);
  const copy = await draftForCommand(db, duplicateArgs);
  await saveDraft(db, copy, duplicateArgs, "duplication", { mustExist: false });
  assert.equal(db.records.get("scheduleItems/test-publication"), original);
  assert.equal(db.records.get("workflowStates/test-copy"), undefined); assert.equal(db.records.get("scheduleItems/test-copy").status, "pending");
  assert.equal(db.records.get("mediaDecisions/test-copy"), undefined);
});
await check("restaurer un brouillon classé conserve la fonction d’archive réversible", async () => {
  const db = database({ ...initial({}, { editorial: { ...row.editorial, archivedEditorial: true } }), "changeArchive/old": { entityType: "publicationContent", entityId: draft.id, after: row } });
  const restoreArgs = parseArgs(["restore", "--id", draft.id, "--archive-id", "old", "--apply", "--actor-uid", "test-admin"]);
  const restored = await draftForCommand(db, restoreArgs);
  await saveDraft(db, restored, restoreArgs, "restauration", { mustExist: true });
  assert.equal(db.records.get("scheduleItems/test-publication").editorial.archivedEditorial, false); assert(db.records.has("changeArchive/old"));
});
await check("aucune date impossible acceptée par la reprogrammation", async () => {
  for (const date of ["2026-02-30", "2026-02-29", "2026-13-01"]) await assert.rejects(draftForCommand(database(initial()), parseArgs(["reschedule", "--id", draft.id, "--date", date])), /date réelle/);
});
await check("compte non administrateur actif : écriture refusée", async () => {
  for (const profile of [{ role: "director", active: true }, { role: "admin", active: false }]) {
    const db = database({ ...initial(), "users/test-admin": profile });
    await assert.rejects(saveDraft(db, draft, args(true), "test"), /admin actif/); assert.equal(db.writes.length, 0);
  }
});
console.log(`✓ ${passed} scénarios transactionnels du Studio local, aucune connexion externe.`);
