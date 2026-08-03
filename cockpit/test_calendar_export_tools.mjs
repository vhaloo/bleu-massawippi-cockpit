import assert from "node:assert/strict";
import { buildPostCalendarIcs, buildWeeklyCoordinationIcs, parsePlanDate, profileTaskLabel } from "./calendar-export-tools.js";

const iso = parsePlanDate({ dateIso: "2026-08-30" });
assert.equal(iso?.getFullYear(), 2026);
assert.equal(iso?.getMonth(), 7);
assert.equal(iso?.getDate(), 30);

const french = parsePlanDate("dimanche 30 août");
assert.equal(french?.getMonth(), 7);
assert.equal(french?.getDate(), 30);

const post = buildPostCalendarIcs({
  id: "post-test",
  dateIso: "2026-08-30",
  title: "Au bord du bleu",
  tasksAnnie: ["Confirmer la logistique."],
  tasksValentin: ["Préparer la publication."],
  source: "https://bleumassawippi.com"
}, {
  role: "director",
  schedule: { calendarTime: "13:00", calendarDurationMinutes: 180, calendarLocation: "Parc Lôbadanaki" }
});
assert.match(post.filename, /2026-08-30\.ics$/);
assert.match(post.content, /SUMMARY:Publication — Au bord du bleu/);
assert.match(post.content, /Parc Lôbadanaki/);
assert.match(post.content, /Confirmer la logistique/);
assert.doesNotMatch(post.content, /Préparer la publication/);

const weekly = buildWeeklyCoordinationIcs({
  weekday: 1,
  hour: 10,
  duration: 60,
  role: "admin",
  now: new Date(2026, 7, 3, 9, 0, 0, 0)
});
assert.match(weekly.filename, /2026-08-03\.ics$/);
assert.match(weekly.content, /Valentin — Directeur des communications/);
assert.equal(profileTaskLabel("director"), "Annie — Directrice générale");

console.log("Calendar export tools: OK");
