import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  acquireLock,
  atomicWriteJson,
  buildSummary,
  normalizeFirestoreValue,
  parseTargetSpecs,
  readIncrementalCollections,
  updateActiveMirror
} from "./admin_sync.js";

const FieldPath = { documentId: () => "__name__" };

class FakeDocument {
  constructor(collection, id, data) {
    this.id = id;
    this._data = data;
    this.ref = { path: `${collection}/${id}` };
  }

  data() {
    return this._data;
  }
}

class FakeQuery {
  constructor(database, collection, state = {}) {
    this.database = database;
    this.collectionName = collection;
    this.filters = state.filters || [];
    this.orders = state.orders || [];
    this.after = state.after || null;
    this.maximum = state.maximum ?? Infinity;
  }

  clone(changes) {
    return new FakeQuery(this.database, this.collectionName, {
      filters: this.filters,
      orders: this.orders,
      after: this.after,
      maximum: this.maximum,
      ...changes
    });
  }

  where(field, operator, value) {
    return this.clone({ filters: [...this.filters, { field, operator, value }] });
  }

  orderBy(field, direction) {
    return this.clone({ orders: [...this.orders, { field, direction }] });
  }

  startAfter(timestamp, id) {
    return this.clone({ after: { timestamp: new Date(timestamp), id } });
  }

  limit(maximum) {
    return this.clone({ maximum });
  }

  async get() {
    this.database.queryCount += 1;
    let documents = (this.database.datasets[this.collectionName] || []).map(({ id, data }) => new FakeDocument(this.collectionName, id, data));
    for (const filter of this.filters) {
      documents = documents.filter((document) => {
        const raw = filter.field === "__name__" ? document.id : document.data()[filter.field];
        const comparable = raw instanceof Date ? raw.valueOf() : raw;
        const expected = filter.value instanceof Date ? filter.value.valueOf() : filter.value;
        if (filter.operator === ">=") return comparable >= expected;
        if (filter.operator === "<=") return comparable <= expected;
        if (filter.operator === "==") return comparable === expected;
        throw new Error(`Opérateur de test non pris en charge : ${filter.operator}`);
      });
    }
    const timestampField = this.orders.find(({ field }) => field !== "__name__")?.field;
    documents.sort((left, right) => {
      const leftTime = left.data()[timestampField]?.valueOf?.() ?? 0;
      const rightTime = right.data()[timestampField]?.valueOf?.() ?? 0;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });
    if (this.after) {
      documents = documents.filter((document) => {
        const timestamp = document.data()[timestampField].valueOf();
        return timestamp > this.after.timestamp.valueOf()
          || (timestamp === this.after.timestamp.valueOf() && document.id > this.after.id);
      });
    }
    documents = documents.slice(0, this.maximum);
    return { docs: documents, size: documents.length };
  }
}

class FakeFirestore {
  constructor(datasets = {}) {
    this.datasets = datasets;
    this.queryCount = 0;
  }

  collection(name) {
    return new FakeQuery(this, name);
  }
}

const definitions = [
  { name: "scheduleItems", timestampField: "updatedAt" },
  { name: "comments", timestampField: "updatedAt" },
  { name: "auditLogs", timestampField: "createdAt" },
  { name: "cockpitFeedback", timestampField: "updatedAt" },
  { name: "tasks", timestampField: "updatedAt" },
  { name: "actionItems", timestampField: "updatedAt" },
  { name: "changeArchive", timestampField: "createdAt" },
  { name: "privateContentVersions", timestampField: "createdAt" },
  { name: "mediaLinks", timestampField: "updatedAt" },
  { name: "mediaDecisions", timestampField: "updatedAt" },
  { name: "workflowStates", timestampField: "updatedAt" },
  { name: "editorialDecisions", timestampField: "updatedAt" },
  { name: "opportunityStates", timestampField: "updatedAt" },
  { name: "internalProjectStates", timestampField: "updatedAt" }
];

const upperBound = new Date("2026-07-14T07:30:00.000Z");
const baselineDate = new Date("2026-07-01T00:00:00.000Z");

{
  const database = new FakeFirestore();
  const result = await readIncrementalCollections({
    db: database,
    FieldPath,
    definitions,
    checkpoint: null,
    baselineDate,
    upperBound,
    overlapSeconds: 120,
    pageSize: 100,
    readCap: 500
  });
  assert.equal(result.complete, true);
  assert.equal(result.metrics.queryCount, 14);
  assert.equal(result.metrics.documentsFetched, 0);
  assert.equal(result.metrics.estimatedDocumentReads, 14);
  assert.ok(result.metrics.estimatedDocumentReads < 25, "Une synchronisation vide doit rester sous 25 lectures estimées.");
}

{
  const changedAt = new Date("2026-07-14T07:29:30.000Z");
  const database = new FakeFirestore({
    comments: [{ id: "comment-1", data: { comment: "Bonjour", updatedAt: changedAt, createdAt: changedAt, resolved: false } }]
  });
  const first = await readIncrementalCollections({
    db: database,
    FieldPath,
    definitions,
    checkpoint: null,
    baselineDate,
    upperBound,
    overlapSeconds: 120,
    pageSize: 100,
    readCap: 500
  });
  assert.equal(first.rowsByCollection.comments.length, 1);
  const checkpoint = { collections: first.collectionCheckpoints };
  const second = await readIncrementalCollections({
    db: database,
    FieldPath,
    definitions,
    checkpoint,
    baselineDate,
    upperBound: new Date("2026-07-14T07:31:00.000Z"),
    overlapSeconds: 120,
    pageSize: 100,
    readCap: 500
  });
  assert.equal(second.metrics.documentsFetched, 1, "Le chevauchement relit volontairement le document récent.");
  assert.equal(second.rowsByCollection.comments.length, 0, "L’empreinte du checkpoint doit supprimer le doublon du delta.");
}

{
  const datasets = {};
  for (const definition of definitions) {
    datasets[definition.name] = Array.from({ length: 10 }, (_, index) => ({
      id: `${definition.name}-${String(index).padStart(2, "0")}`,
      data: { [definition.timestampField]: new Date(`2026-07-14T07:2${index}:00.000Z`) }
    }));
  }
  const result = await readIncrementalCollections({
    db: new FakeFirestore(datasets),
    FieldPath,
    definitions,
    checkpoint: null,
    baselineDate,
    upperBound,
    overlapSeconds: 0,
    pageSize: 100,
    readCap: 24
  });
  assert.equal(result.metrics.estimatedDocumentReads, 24);
  assert.equal(result.metrics.queryCount, 14, "Le premier tour doit réserver au moins une requête à chaque collection.");
  assert.equal(result.complete, false);
  assert.ok(result.pendingCollections.length > 0);
}

{
  const sharedTimestamp = new Date("2026-07-14T07:29:00.000Z");
  const database = new FakeFirestore({
    mediaLinks: Array.from({ length: 30 }, (_, index) => ({
      id: `media-${String(index).padStart(2, "0")}`,
      data: { updatedAt: sharedTimestamp, eventId: "s1d4" }
    }))
  });
  const first = await readIncrementalCollections({
    db: database,
    FieldPath,
    definitions,
    checkpoint: null,
    baselineDate,
    upperBound,
    overlapSeconds: 120,
    pageSize: 10,
    readCap: 25
  });
  assert.equal(first.complete, false);
  assert.ok(first.rowsByCollection.mediaLinks.length > 0);
  const firstIds = new Set(first.rowsByCollection.mediaLinks.map(({ id }) => id));
  const second = await readIncrementalCollections({
    db: database,
    FieldPath,
    definitions,
    checkpoint: { collections: first.collectionCheckpoints },
    baselineDate,
    upperBound,
    overlapSeconds: 120,
    pageSize: 10,
    readCap: 25
  });
  assert.ok(second.rowsByCollection.mediaLinks.every(({ id }) => !firstIds.has(id)), "La reprise ne doit pas relire la page déjà consommée.");
  assert.ok(second.collectionCheckpoints.mediaLinks.cursor.id > first.collectionCheckpoints.mediaLinks.cursor.id, "Le curseur doit progresser entre deux passages bornés.");
}

{
  const redactions = [];
  const normalized = normalizeFirestoreValue({ title: "Visible", apiKey: "secret-value", nested: { refresh_token: "secret-two" } }, "doc", redactions);
  assert.equal(normalized.title, "Visible");
  assert.equal(normalized.apiKey, "[REDACTED]");
  assert.equal(normalized.nested.refresh_token, "[REDACTED]");
  assert.deepEqual(redactions, ["doc.apiKey", "doc.nested.refresh_token"]);
}

{
  const generatedAt = "2026-07-14T07:30:00.000Z";
  const mirror = updateActiveMirror(null, {
    tasks: [{ id: "task-open", status: "pending", updatedAt: generatedAt }, { id: "task-done", status: "done", updatedAt: generatedAt }],
    actionItems: [{ id: "action-open", state: "pending", updatedAt: generatedAt }, { id: "action-done", state: "done", updatedAt: generatedAt }],
    comments: [{ id: "comment-open", resolved: false, updatedAt: generatedAt }],
    cockpitFeedback: [{ id: "feedback-open", status: "open", updatedAt: generatedAt }]
  }, { projectId: "demo", generatedAt, coverageStart: baselineDate.toISOString() });
  assert.deepEqual(mirror.active.tasks.map(({ id }) => id), ["task-open"]);
  assert.deepEqual(mirror.active.actionItems.map(({ id }) => id), ["action-open"]);
  assert.deepEqual(mirror.active.comments.map(({ id }) => id), ["comment-open"]);
  assert.deepEqual(mirror.active.cockpitFeedback.map(({ id }) => id), ["feedback-open"]);
  const afterResolution = updateActiveMirror(mirror, {
    tasks: [{ id: "task-open", status: "done", updatedAt: generatedAt }],
    actionItems: [{ id: "action-open", state: "done", updatedAt: generatedAt }],
    comments: [],
    cockpitFeedback: []
  }, { projectId: "demo", generatedAt, coverageStart: baselineDate.toISOString() });
  assert.equal(afterResolution.active.tasks.length, 0, "Un élément clos sort du miroir actif sans être supprimé de Firestore.");
  assert.equal(afterResolution.active.actionItems.length, 0);
}

{
  const summary = buildSummary({
    scheduleItems: [], comments: [], auditLogs: [], cockpitFeedback: [], tasks: [], actionItems: [], changeArchive: [],
    privateContentVersions: [], mediaLinks: [], mediaDecisions: [], workflowStates: [], editorialDecisions: [],
    opportunityStates: [{ id: "opp", stage: "watch" }], internalProjectStates: [{ id: "project", stage: "active" }]
  }, { generatedAt: upperBound.toISOString(), since: baselineDate.toISOString(), checkpoint: {}, metrics: {} });
  assert.equal(summary.mode, "incremental");
  assert.equal(summary.opportunityStates[0].opportunityId, "opp");
  assert.equal(summary.internalProjectStates[0].projectId, "project");
}

assert.deepEqual(parseTargetSpecs("scheduleItems/alt-20260715,mediaLinks/nature-v5"), [
  { collection: "scheduleItems", id: "alt-20260715" },
  { collection: "mediaLinks", id: "nature-v5" }
]);
assert.throws(() => parseTargetSpecs("unknown/id"), /non permise/);
assert.throws(() => parseTargetSpecs("scheduleItems/a/b"), /non permise/);

{
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bleu-admin-sync-test-"));
  try {
    const output = path.join(temporaryRoot, "state.json");
    await atomicWriteJson(output, { version: 1 });
    await atomicWriteJson(output, { version: 2 });
    assert.deepEqual(JSON.parse(await fs.readFile(output, "utf8")), { version: 2 });
    const release = await acquireLock(path.join(temporaryRoot, ".lock"));
    await assert.rejects(() => acquireLock(path.join(temporaryRoot, ".lock")), /déjà active/);
    await release();
    const releaseAgain = await acquireLock(path.join(temporaryRoot, ".lock"));
    await releaseAgain();
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

console.log("✓ admin_sync incrémental : 9 contrats vérifiés");
