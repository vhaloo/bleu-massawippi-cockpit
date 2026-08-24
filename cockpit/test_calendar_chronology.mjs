import assert from "node:assert/strict";
import fs from "node:fs";
import { applyPlanOverridesToPosts } from "./plan-overrides.js";
import { mergePostsWithScheduleRows, schedulePayloadFromDraft } from "./publication-editor-schema.mjs";

const source = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
assert.ok(postsJson, "Le calendrier source doit rester lisible.");
const basePosts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const activePosts = basePosts.filter((post) => post.archivedEditorial !== true && post.dateIso >= "2026-08-24");
assert.ok(activePosts.length >= 20, "Le test doit couvrir plusieurs semaines réelles du calendrier.");

const staleWeekByDate = new Map([
  ["2026-08-24", 8],
  ["2026-08-27", 7],
  ["2026-09-07", 8],
  ["2026-09-02", 9],
  ["2026-09-13", 8]
]);
const rows = activePosts.filter((post) => staleWeekByDate.has(post.dateIso)).map((post) => ({
  id: post.id,
  ...schedulePayloadFromDraft({
    ...post,
    title: post.title,
    dateIso: post.dateIso,
    week: staleWeekByDate.get(post.dateIso),
    copy: post.copy || "FR — Publication de test.\n\nEN — Test publication."
  })
}));

const merged = mergePostsWithScheduleRows(basePosts, rows)
  .filter((post) => post.archivedEditorial !== true && post.dateIso >= "2026-08-24");
const renderedOrder = [...new Set(merged.map((post) => Number(post.w)))]
  .sort((left, right) => left - right)
  .flatMap((week) => merged.filter((post) => Number(post.w) === week)
    .sort((left, right) => left.dateIso.localeCompare(right.dateIso) || String(left.id).localeCompare(String(right.id))))
  .map((post) => post.dateIso);
const expectedOrder = [...renderedOrder].sort((left, right) => left.localeCompare(right));

assert.deepEqual(renderedOrder, expectedOrder,
  "La liste latérale et les blocs du calendrier doivent rester chronologiques malgré des semaines Firestore périmées.");
assert.equal(merged.find((post) => post.dateIso === "2026-08-24")?.w, 7);
assert.equal(merged.find((post) => post.dateIso === "2026-09-02")?.w, 8);
assert.equal(merged.find((post) => post.dateIso === "2026-09-07")?.w, 9);
assert.ok(basePosts.filter((post) => post.archivedEditorial === true).every((post) => post.w === 98),
  "Les archives restent hors du calendrier actif.");

console.log(`✓ calendrier chronologique : ${renderedOrder.length} publications actives, semaines périmées neutralisées`);
