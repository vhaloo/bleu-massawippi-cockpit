import assert from "node:assert/strict";
import fs from "node:fs";
import { mergeEventWindow } from "./event-context-window.mjs";

const recent = [{ id: "new", eventId: "open" }, { id: "other", eventId: "other" }];
const full = { eventId: "open", rows: [{ id: "new", eventId: "open" }, { id: "approved-old", eventId: "open" }] };
const before = JSON.stringify({ recent, full });
assert.equal(mergeEventWindow(recent, "eventId").get("open").length, 1);
assert.deepEqual(mergeEventWindow(recent, "eventId", full).get("open").map(r => r.id), ["new", "approved-old"]);
assert.equal(mergeEventWindow(recent, "eventId", full).get("other")[0].id, "other");
assert.equal(mergeEventWindow([], "eventId", full).get("open").length, 2);
assert.deepEqual(mergeEventWindow(recent, "eventId", { eventId: "open", rows: [] }).get("open"), []);
assert.equal(mergeEventWindow(recent, "eventId", null).get("open").length, 1);
assert.equal(JSON.stringify({ recent, full }), before);
const comments = [{ id: "recent", sectionId: "open" }];
assert.equal(mergeEventWindow(comments, "sectionId", { eventId: "open", rows: [...comments, { id: "older", sectionId: "open" }] }).get("open").length, 2);

const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const context = fs.readFileSync(new URL("./event-context-data.js", import.meta.url), "utf8");
assert(ui.includes('mergeEventWindow(rows, "eventId", eventContextController?.snapshot("media"))'));
assert(ui.includes('mergeEventWindow(rows, "sectionId", eventContextController?.snapshot("comments"))'));
assert(context.includes("snapshots.clear()"));
assert.equal((context.match(/generation !== activeGeneration/g) || []).length, 2);

// Execute the real controller with local listeners only: no Firebase/network.
const listeners = { comments: [], media: [] };
let closed = 0;
const subscribe = kind => (eventId, callback) => {
  listeners[kind].push({ eventId, callback });
  return () => { closed++; };
};
const factory = new Function("subscribeCommentsForSection", "subscribeMediaLinksForEvent",
  context.replace(/^import .*firebase-client.*;\r?\n/m, "")
    .replace("export function createEventContextController", "function createEventContextController")
  + "\nreturn createEventContextController;");
const createController = factory(subscribe("comments"), subscribe("media"));
const deliveries = [];
const controller = createController({ enabled: true, onRows: (...row) => deliveries.push(row) });
controller.activate("open-event");
assert.equal(controller.snapshot("media"), null);
listeners.media[0].callback(full.rows);
assert.deepEqual(controller.snapshot("media"), { eventId: "open-event", rows: full.rows });
listeners.comments[0].callback(comments);
assert.equal(controller.snapshot("comments").rows.length, 1);
controller.activate("open-event");
assert.equal(listeners.media.length, 1);
controller.activate("other-event");
assert.equal(controller.snapshot("media"), null);
listeners.media[0].callback([{ id: "late" }]);
assert.equal(deliveries.length, 2);
controller.activate("open-event");
listeners.media[0].callback([{ id: "late-same-id" }]);
listeners.comments[0].callback([{ id: "late-comment-same-id" }]);
assert.equal(deliveries.length, 2);
assert.equal(controller.snapshot("comments"), null);
listeners.media[2].callback([]);
assert.deepEqual(controller.snapshot("media"), { eventId: "open-event", rows: [] });
controller.stop();
assert.equal(controller.current(), "");
assert.equal(controller.snapshot("media"), null);
listeners.media[2].callback([{ id: "after-stop" }]);
assert.equal(deliveries.length, 3);
assert.equal(closed, 6);
controller.activate("!");
assert.equal(listeners.media.length, 3);
createController({ enabled: false }).activate("valid-event");
assert.equal(listeners.media.length, 3);
console.log("✓ 27 contrôles contexte : média approuvé ancien, fenêtre partielle, commentaires, réponses tardives, retour au même dossier, vide autoritaire et arrêt");
