import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("./project-calendar.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("./project-calendar.css", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("./firebase-client.js", import.meta.url), "utf8");
const rules = fs.readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");
const sync = fs.readFileSync(new URL("./admin_sync.js", import.meta.url), "utf8");
const seed = fs.readFileSync(new URL("./project_calendar_events.json", import.meta.url), "utf8");

assert.match(ui, /Calendrier des projets et échéances/);
assert.match(ui, /Proposer un événement/);
assert.match(ui, /n’est pas publiée et ne devient pas automatiquement un événement final/);
assert.match(ui, /Les fichiers restent dans OneDrive ou SharePoint/);
assert.match(ui, /Ajouter à mon agenda/);
assert.match(ui, /import \{ navigateToEntity \} from "\.\/view-mode\.js\?v=/);
assert.match(ui, /navigateToEntity\(\{ type: "project", id: projectId \}\)/);
assert.match(ui, /bindRelatedProjectButtons\(agenda\)/);
assert.match(ui, /control\.dataset\.projectNavigationBound === "true"/);
assert.match(ui, /event\.stopPropagation\(\)/);
assert.doesNotMatch(ui, /project\.open = true; project\.scrollIntoView/);
assert.match(ui, /IntersectionObserver/);
assert.match(ui, /stopSubscriptions\(\)/);
assert.match(ui, /data-project-event-mic/);
assert.match(css, /@media\(max-width:900px\)/);
assert.match(css, /html\[data-theme="dark"\]/);
assert.match(css, /data-urgency="urgent"/);

assert.match(client, /limit\(boundedMaximum\)/);
assert.match(client, /maximum = 30/);
assert.match(client, /maximum = 120/);
assert.match(client, /where\("endDate", ">=", floor\)/);
assert.match(client, /changeArchiveEntry\("projectEventProposal"/);
assert.match(client, /changeArchiveEntry\("projectCalendarEvent"/);

assert.match(rules, /match \/projectEventProposals\/\{proposalId\}/);
assert.match(rules, /request\.query\.limit <= 50/);
assert.match(rules, /match \/projectCalendarEvents\/\{eventId\}/);
assert.match(rules, /request\.query\.limit <= 150/);
assert.match(rules, /allow delete: if false;/);

assert.match(sync, /projectEventProposals/);
assert.match(sync, /projectCalendarEvents/);
assert.match(seed, /2026-08-30/);
assert.match(seed, /2026-08-03/);
assert.doesNotMatch(ui, /\b(?:Codex|ChatGPT|intelligence artificielle|\bAI\b)\b/i);
assert.doesNotMatch(ui, /firebase storage|téléverser dans firebase/i);

console.log("✓ contrat du calendrier de projets : interface, quotas, confidentialité, règles et cycle éditorial vérifiés.");
