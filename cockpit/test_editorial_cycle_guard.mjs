import assert from "node:assert/strict";
import {assertPublicationMutable, reschedulePatch} from "./editorial-cycle-guard.mjs";
for (const stage of ["completed", "published", "scheduled", "done"]) {
  assert.throws(() => assertPublicationMutable("test", {}, {stage}));
  assert.throws(() => assertPublicationMutable("test", {status:stage}, {}));
}
for (const data of [{completed:true},{published:true},{scheduled:true},{deleted:true},{editorial:{archivedEditorial:true}}]) {
  assert.throws(() => assertPublicationMutable("test", data, {}));
}
assert.doesNotThrow(() => assertPublicationMutable("test", {status:"pending"}, {stage:"final_approved"}));
const original = {editorial:{copy:"texte validé",week:4,dateIso:"2026-08-07"},status:"pending",selected:true};
const patch = reschedulePatch({date:"Vendredi 2 octobre",dateIso:"2026-10-02",w:12},original);
assert.deepEqual(Object.keys(patch).sort(), ["dateKey","dateIso","editorial.dateIso","editorial.dateLabel","editorial.week"].sort());
assert.equal(original.editorial.copy,"texte validé");
assert.equal(original.editorial.week,4);
console.log(JSON.stringify({passed:true,protectedCases:13,preservedCopy:true,datesOnly:true}));
