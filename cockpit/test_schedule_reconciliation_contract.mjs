import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts } from "./plan-overrides.js";
import { mergePostsWithScheduleRows } from "./publication-editor-schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, "..", "index.html"), "utf8");
const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
assert.ok(postsJson, "Le calendrier source doit rester lisible.");
const posts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const tool = fs.readFileSync(path.join(here, "schedule_reconciliation.mjs"), "utf8");

assert.match(tool, /applyChanges && requestedIds\.length === 0/, "Une application doit exiger des identifiants explicites.");
assert.match(tool, /applyChanges && reason\.length < 20/, "Une application doit exiger une justification substantielle.");
assert.match(tool, /workflowStage === "completed"/, "Une publication terminée doit rester immobile.");
assert.match(tool, /documents\/changeArchive/, "Toute mutation doit être archivée.");
assert.match(tool, /currentDocument: updateTime \? \{ updateTime \}/, "Les mises à jour doivent utiliser une précondition optimiste.");
assert.match(tool, /writes: 0/, "Le mode de contrôle doit annoncer explicitement zéro écriture.");

const staleRows = [
  {
    id: "alt-20260721",
    dateIso: "2026-08-24",
    editorial: {
      title: "Le plongeon huard (Gavia immer), voix du lac",
      dateIso: "2026-08-24",
      week: 7,
      theme: "Nature",
      archivedEditorial: false
    }
  },
  {
    id: "s4d2",
    dateIso: "2026-08-23",
    editorial: {
      title: "Sur l’eau, le plaisir se partage",
      dateIso: "2026-08-23",
      week: 7,
      theme: "Vie au lac",
      archivedEditorial: false
    }
  }
];
const staleMerged = mergePostsWithScheduleRows(posts, staleRows).filter((post) => post.archivedEditorial !== true && post.dateIso >= "2026-08-17");
const staleByDate = Object.groupBy(staleMerged, (post) => post.dateIso);
assert.deepEqual(staleByDate["2026-08-23"].map((post) => post.id).sort(), ["s4d2", "s4d4"]);
assert.deepEqual(staleByDate["2026-08-24"].map((post) => post.id).sort(), ["alt-20260721", "s4d3"]);

const repairedRows = staleRows.map((row) => ({
  ...row,
  dateIso: posts.find((post) => post.id === row.id).dateIso,
  editorial: { ...row.editorial, dateIso: posts.find((post) => post.id === row.id).dateIso }
}));
const repaired = mergePostsWithScheduleRows(posts, repairedRows).filter((post) => post.archivedEditorial !== true && post.dateIso >= "2026-08-17");
const repairedByDate = Object.groupBy(repaired, (post) => post.dateIso);
assert.ok(Object.values(repairedByDate).every((items) => items.length === 1), "La réconciliation doit restaurer une seule publication active par date.");

console.log(JSON.stringify({ passed: true, reproducedDuplicateDates: 2, repairedDuplicateDates: 0 }, null, 2));
