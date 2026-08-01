import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sameSeedFields } from "./seed_utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(here, name), "utf8");

assert.equal(sameSeedFields({ a: 1, b: [2] }, { a: 1, b: [2] }), true);
assert.equal(sameSeedFields({ a: 1 }, { a: 2 }), false);

for (const file of [
  "seed_editorial_media_links.js",
  "seed_historical_media_links.js",
  "seed_nature_media_links.js",
  "seed_internal_project_states.js",
  "seed_content_notices.js",
  "seed_opportunity_states.js",
  "seed_media_config.js",
  "seed_private_content.js",
  "seed_open_house_attachments.js"
]) {
  const source = read(file);
  assert.match(source, /dryRun|isDryRun|--dry-run/, `${file} doit offrir une validation sans écriture.`);
}

for (const file of ["seed_editorial_media_links.js", "seed_historical_media_links.js", "seed_nature_media_links.js"]) {
  const source = read(file);
  assert.match(source, /sameSeedFields/);
  assert.match(source, /created \+ updated > 0/);
  assert.match(source, /unchanged/);
}
assert.match(read("seed_historical_media_links.js"), /--event=/,
  "La banque historique doit pouvoir être synchronisée par événement afin d’éviter une relecture globale.");

assert.match(read("seed_private_content.js"), /contentChanged/);
assert.match(read("seed_private_content.js"), /if \(writeOperations > 0\) await batch\.commit\(\)/);
assert.match(read("seed_private_content.js"), /mainPosts\.length < 28/,
  "La synchronisation doit accepter un calendrier durable au-delà des 28 publications initiales.");
assert.match(read("seed_open_house_attachments.js"), /disabledByDefault: true/);
assert.match(read("seed_content_notices.js"), /if \(existing\.exists\)[\s\S]*preserved \+= 1/);
assert.match(read("seed_content_notices.js"), /Une version vue ne doit jamais être rouverte/);
const contentNotices = JSON.parse(read("content_notices.json"));
assert.equal(contentNotices.schemaVersion, 1);
assert.equal(contentNotices.notices.length, 9);
assert.ok(contentNotices.notices.every((item) => item.audienceRole === "director" && item.assigneeEmail === "dg@bleumassawippi.com"));
for (const id of ["strategic-zeffy-recurring-gifts-v1", "internal-application-funding-nonmunicipal-v1", "internal-poetry-progress-v2", "internal-poetry-progress-v3", "internal-youth-drawing-toolkit-v1"]) {
  assert.ok(contentNotices.notices.some((item) => item.id === id), `La nouveauté ${id} doit être versionnée dans le manifeste.`);
}
console.log("Contrat d’idempotence des synchronisations : OK");
