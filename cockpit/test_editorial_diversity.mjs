import assert from "node:assert/strict";
import fs from "node:fs";
import { applyPlanOverridesToPosts } from "./plan-overrides.js";
import { findEditorialFamilyConflicts, findTopicSignatureConflicts } from "./editorial-diversity.js";

const source = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
assert.ok(postsJson, "Le calendrier source doit rester lisible.");

const posts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const conflicts = findEditorialFamilyConflicts(posts, { minimumGapDays: 7 });
assert.deepEqual(conflicts, [], "Deux publications de la même famille éditoriale étroite ne doivent pas se suivre à moins de sept jours.");
const topicConflicts = findTopicSignatureConflicts(posts, { minimumGapDays: 7 });
assert.deepEqual(topicConflicts, [], "Deux publications portant la même signature thématique étroite ne doivent pas se suivre à moins de sept jours.");

const iris = posts.find((post) => post.id === "s2d1");
const waterLily = posts.find((post) => post.id === "alt-20260805");
assert.equal(iris?.editorialFamily, "flore-aquatique");
assert.equal(waterLily?.editorialFamily, "flore-aquatique");
assert.match(iris?.topicSignature || "", /plante-aquatique/);
assert.match(waterLily?.topicSignature || "", /plante-aquatique/);
assert.equal(iris?.dateIso, "2026-08-16");
assert.equal(waterLily?.dateIso, "2026-09-02");
assert.match(iris?.copy || "", /Un iris ne se cueille pas, il se contemple\./,
  "La légende doit conserver la formulation retenue par la direction pour décourager la cueillette avec douceur.");
assert.doesNotMatch(iris?.copy || "", /plante envahissante|flore humide/u,
  "La légende ne doit plus contenir les formulations que la direction a demandé de retirer.");
assert.match(iris?.copy || "", /=========================================/,
  "La publication sur l’iris doit rester bilingue.");
assert.ok((iris?.copy || "").length <= 2200,
  "La publication bilingue sur l’iris doit respecter la limite de 2 200 caractères.");

const simulatedConflict = findEditorialFamilyConflicts([
  { id: "iris", dateIso: "2026-08-16", editorialFamily: "flore-aquatique" },
  { id: "nenuphar", dateIso: "2026-08-19", editorialFamily: "flore-aquatique" }
]);
assert.equal(simulatedConflict.length, 1, "Le garde-fou doit détecter une répétition artificiellement réintroduite.");

const simulatedTopicConflict = findTopicSignatureConflicts([
  { id: "rive-a", dateIso: "2026-08-16", topicSignature: "rive-vegetalisee" },
  { id: "rive-b", dateIso: "2026-08-20", topicSignature: "rive-vegetalisee,bassin-versant" }
]);
assert.equal(simulatedTopicConflict.length, 1, "Le garde-fou doit détecter une répétition thématique même entre deux familles de formats différentes.");

console.log(JSON.stringify({ passed: true, minimumGapDays: 7, familyConflicts: 0, topicConflicts: 0 }, null, 2));
