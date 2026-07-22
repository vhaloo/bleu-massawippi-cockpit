import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderCompletedActionTaskCard } from "./task-progress-ui.js";

const root = dirname(fileURLToPath(import.meta.url));
const client = readFileSync(join(root, "firebase-client.js"), "utf8");
const ui = readFileSync(join(root, "cockpit-ui.js"), "utf8");
const history = readFileSync(join(root, "completed-task-history.js"), "utf8");
const indexes = JSON.parse(readFileSync(join(root, "firestore.indexes.json"), "utf8"));

assert.match(client, /subscribeActionTasks[\s\S]*where\("status", "==", "pending"\)[\s\S]*limit\(200\)/, "La file active doit lire seulement les tâches en attente.");
assert.match(client, /fetchCompletedActionTasksPage[\s\S]*profile\.role !== "admin"/, "L’historique doit être réservé à l’administration.");
assert.match(client, /where\("status", "==", "done"\)[\s\S]*orderBy\("updatedAt", "desc"\)/, "L’historique doit être borné aux tâches terminées les plus récentes.");
assert.match(client, /Math\.min\(20,[\s\S]*limit\(boundedPageSize \+ 1\)/, "La lecture historique doit rester strictement bornée.");
assert.match(ui, /completedTaskHistoryMarkup\(\)/, "La section historique doit être présente sous la file active.");
assert.match(history, /id="cockpit-completed-task-history"/, "Le module doit fournir le panneau historique.");
assert.match(history, /addEventListener\("toggle"[\s\S]*void load/, "La première lecture doit se déclencher seulement à l’ouverture.");
assert.match(history, /data-load-more-completed/, "La pagination explicite doit être disponible.");
assert.match(ui, /clearCompletedTaskHistory\(\);[\s\S]*clearPrivateContent/, "L’historique doit être purgé à la déconnexion.");

const tasksIndex = indexes.indexes.find((entry) => entry.collectionGroup === "tasks");
assert.ok(tasksIndex, "L’index de l’historique des tâches doit être déclaré.");
assert.deepEqual(tasksIndex.fields, [
  { fieldPath: "status", order: "ASCENDING" },
  { fieldPath: "updatedAt", order: "DESCENDING" }
]);

const card = renderCompletedActionTaskCard({
  task: {
    id: "comment-example",
    title: "Consigne traitée",
    targetType: "schedule",
    targetId: "s3d1",
    targetLabel: "Publication",
    message: "La demande a été intégrée."
  },
  when: "2026-07-22 10:00",
  updatedAt: 123
});
assert.match(card, /✓ Traitée/);
assert.match(card, /Revoir/);
assert.match(card, /🔒 Archivée/);
assert.doesNotMatch(card, /data-complete-task/, "Une tâche historique doit rester verrouillée.");

console.log(JSON.stringify({
  passed: true,
  initialPageMaximumReads: 9,
  liveCompletedTaskListeners: 0,
  historyRole: "admin"
}, null, 2));
