import assert from "node:assert/strict";
import {
  datesForEvent,
  eventIntersectsMonth,
  isIsoDate,
  monthGridDates,
  normalizeProjectCalendarEvent,
  normalizeProjectEventProposal,
  projectEventIcs
} from "./project-calendar-model.mjs";

assert.equal(isIsoDate("2026-02-28"), true);
assert.equal(isIsoDate("2026-02-30"), false);
assert.equal(isIsoDate("03-08-2026"), false);

const proposal = normalizeProjectEventProposal({
  title: "  Rencontre au parc  ",
  description: "Préciser la zone et le plan météo.",
  startDate: "2026-08-10",
  endDate: "2026-08-12",
  category: "meeting",
  urgency: "urgent",
  attachmentUrl: "https://bleumassawippi.sharepoint.com/:f:/g/exemple",
  attachmentLocation: "Media Cockpit / Poésie"
});
assert.equal(proposal.title, "Rencontre au parc");
assert.equal(proposal.dateMode, "range");
assert.equal(proposal.status, "submitted");
assert.equal(proposal.endDate, "2026-08-12");
assert.throws(() => normalizeProjectEventProposal({ title: "Test", startDate: "2026-08-12", endDate: "2026-08-10" }), /date de fin/i);
assert.throws(() => normalizeProjectEventProposal({ title: "Test", startDate: "2026-08-10", attachmentUrl: "https://example.com/file.pdf" }), /OneDrive|SharePoint/i);

const event = normalizeProjectCalendarEvent({
  title: "Au bord du bleu",
  summary: "Rencontre au lac.",
  startDate: "2026-08-30",
  startTime: "13:00",
  endTime: "16:00",
  category: "field_activity",
  urgency: "important",
  stage: "confirmed",
  actionUrl: "https://forms.office.com/r/4A2xsMh7st",
  actionLabel: "Formulaire",
  location: "Parc Lôbadanaki"
});
assert.equal(event.endDate, "2026-08-30");
assert.equal(event.allDay, false);
assert.equal(event.dateMode, "single");
assert.throws(() => normalizeProjectCalendarEvent({ title: "Test", startDate: "2026-08-10", startTime: "16:00", endTime: "13:00" }), /heure de fin/i);

assert.deepEqual(datesForEvent({ startDate: "2026-08-30", endDate: "2026-09-02" }), ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
assert.equal(eventIntersectsMonth({ startDate: "2026-08-30", endDate: "2026-09-02" }, 2026, 8), true);
assert.equal(eventIntersectsMonth({ startDate: "2026-08-30", endDate: "2026-09-02" }, 2026, 9), false);
const grid = monthGridDates(2026, 7);
assert.equal(grid.length, 42);
assert.equal(grid[0].iso, "2026-07-27");
assert.match(projectEventIcs({ id: "poetry", ...event }), /DTSTART:20260830T130000/);
assert.match(projectEventIcs({ id: "poetry", ...event }), /LOCATION:Parc Lôbadanaki/);

console.log("✓ modèle du calendrier de projets : dates, plages, liens, horaires et ICS vérifiés.");
