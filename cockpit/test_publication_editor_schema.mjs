import assert from "node:assert/strict";
import {
  frenchDateLabel,
  mergePostsWithScheduleRows,
  normalizePublicationDraft,
  publicationIdFrom,
  schedulePayloadFromDraft,
  validatePublicationDraft,
  weekForDate
} from "./publication-editor-schema.mjs";

const draft = normalizePublicationDraft({
  title: "Une rive vivante",
  dateIso: "2026-08-12",
  templateId: "nature",
  copy: "FR — Une rive vivante.\n\nEN — A living shoreline.",
  tasksValentin: "Préparer le visuel\nProgrammer la publication",
  tasksAnnie: ["Valider le contexte"],
  calendarDurationMinutes: 45
}, { startDateIso: "2026-07-13" });
assert.equal(draft.date, "Mercredi 12 août 2026");
assert.equal(draft.theme, "Nature");
assert.equal(draft.week, 5);
assert.equal(draft.tasksValentin.length, 2);
assert.deepEqual(validatePublicationDraft(draft), []);
assert.equal(weekForDate("2026-08-12", "2026-07-13"), 5);
assert.match(publicationIdFrom(draft), /^pub-20260812-une-rive-vivante$/);

const payload = schedulePayloadFromDraft(draft, { status: "pending", selected: true });
assert.equal(payload.editorial.revision, 1);
assert.equal(payload.dateKey, "Mercredi 12 août 2026");
assert.equal(payload.deleted, false);
assert.equal(payload.selected, true);

const base = [{ id: "static", title: "Ancien titre", dateIso: "2026-08-01", date: "Samedi 1 août", t: "Nature", w: 3 }];
const rows = [
  { id: "static", ...payload },
  { id: "new-one", ...schedulePayloadFromDraft({ ...draft, id: "new-one", title: "Nouvelle publication", dateIso: "2026-08-13" }) }
];
const merged = mergePostsWithScheduleRows(base, rows);
assert.equal(merged.length, 2, "Une publication créée dans le Studio doit rejoindre le calendrier.");
assert.equal(merged.find((item) => item.id === "static").title, "Une rive vivante", "Une révision doit remplacer le contenu statique sans changer son identifiant.");
assert.equal(merged.find((item) => item.id === "new-one").t, "Nature");

assert.ok(validatePublicationDraft({ title: "", dateIso: "12 août", copy: "" }).length >= 3);
assert.ok(validatePublicationDraft({ ...draft, copy: "x".repeat(10001) }).some((message) => /dépasse/.test(message)));

console.log("✓ schéma d’édition : normalisation, calendrier, fusion et validations");
