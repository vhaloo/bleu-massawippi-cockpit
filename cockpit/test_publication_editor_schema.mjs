import assert from "node:assert/strict";
import {
  frenchDateLabel,
  mergePostsWithScheduleRows,
  normalizeCalendarWeeks,
  normalizePublicationDraft,
  publicationIdFrom,
  resolvePublicationId,
  schedulePayloadFromDraft,
  uniquePublicationId,
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
assert.equal(publicationIdFrom({ title: "À l’école du lac!", dateIso: "2026-08-13" }), "pub-20260813-a-l-ecole-du-lac");
assert.equal(uniquePublicationId({ title: "Une rive vivante", dateIso: "2026-08-12" }, [
  "pub-20260812-une-rive-vivante",
  "pub-20260812-une-rive-vivante-2"
]), "pub-20260812-une-rive-vivante-3");
assert.equal(resolvePublicationId({
  draft: { title: "Titre changé", dateIso: "2026-09-01" },
  stableId: "publication-historique-stable"
}), "publication-historique-stable", "Un identifiant enregistré doit rester immuable quand le titre ou la date change.");

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

const calendarBase = [
  { id: "aug-24", title: "24 août", dateIso: "2026-08-24", date: "Lundi 24 août 2026", w: 7 },
  { id: "aug-26", title: "26 août", dateIso: "2026-08-26", date: "Mercredi 26 août 2026", w: 7 },
  { id: "sep-02", title: "2 septembre", dateIso: "2026-09-02", date: "Mercredi 2 septembre 2026", w: 8 }
];
const staleWeekRows = calendarBase.map((post, index) => ({
  id: post.id,
  ...schedulePayloadFromDraft({
    ...draft,
    id: post.id,
    title: post.title,
    dateIso: post.dateIso,
    week: index === 0 ? 8 : index === 1 ? 7 : 9
  })
}));
const chronological = mergePostsWithScheduleRows(calendarBase, staleWeekRows);
assert.deepEqual(chronological.map((item) => item.dateIso), ["2026-08-24", "2026-08-26", "2026-09-02"],
  "La fusion doit conserver l’ordre chronologique réel même si une ancienne semaine persiste dans Firestore.");
assert.deepEqual(chronological.map((item) => item.w), [7, 7, 8],
  "La date canonique doit corriger les semaines périmées sans réécrire les publications.");

const withStudioOnlyDate = normalizeCalendarWeeks([
  ...calendarBase,
  { id: "sep-07", title: "7 septembre", dateIso: "2026-09-07", w: 2, week: 2 }
], calendarBase);
assert.equal(withStudioOnlyDate.find((item) => item.id === "sep-07").w, 9,
  "Une nouvelle date du Studio doit être rangée dans sa vraie semaine à partir du calendrier existant.");
assert.equal(normalizeCalendarWeeks([
  { id: "archive", dateIso: "2026-08-24", w: 98, week: 98, archivedEditorial: true }
], calendarBase)[0].w, 98, "Les archives doivent conserver leur rangement distinct du calendrier actif.");

assert.ok(validatePublicationDraft({ title: "", dateIso: "12 août", copy: "" }).length >= 3);
assert.ok(validatePublicationDraft({ ...draft, copy: "x".repeat(10001) }).some((message) => /dépasse/.test(message)));

console.log("✓ schéma d’édition : normalisation, calendrier, fusion et validations");
