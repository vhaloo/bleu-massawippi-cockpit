import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts, preparePlanScript } from "./plan-overrides.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ui = fs.readFileSync(path.join(here, "cockpit-ui.js"), "utf8");
const client = fs.readFileSync(path.join(here, "firebase-client.js"), "utf8");
const firestoreRules = fs.readFileSync(path.join(here, "firestore.rules"), "utf8");
const storageRules = fs.readFileSync(path.join(here, "storage.rules"), "utf8");
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
const postsJson = source.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];
assert.ok(postsJson, "Le tableau des publications source doit rester lisible.");
const posts = applyPlanOverridesToPosts(JSON.parse(postsJson));
const first = posts.find((post) => post.id === "s1d1");
const moved = posts.find((post) => post.id === "s1d1b");

assert.equal(first.title, "Portes ouvertes : venez nous rencontrer");
assert.equal(first.choiceRequired, false);
assert.equal(first.date, "Lundi 13 juillet");
assert.equal(moved.date, "Lundi 10 août");
assert.equal(moved.w, 5);
assert.equal(posts.filter((post) => !post.isAlternative).length, 28);
assert.match(preparePlanScript(source.match(/<script>\s*(var posts=[\s\S]*?)<\/script>/i)[1], posts), /\[1,2,3,4,5\]\.forEach/);

for (const token of ["getUserMedia", "SpeechRecognition", "webkitSpeechRecognition", "data-attachment-input", "uploadImageAttachment", "subscribeImageAttachments", "data-past-toggle", "cockpit-debug-launch"]) {
  assert.ok(ui.includes(token), `Le cockpit doit contenir le contrat ${token}.`);
}
for (const token of ["addComment", "addCockpitFeedback", "MAX_ATTACHMENT_BYTES", "match /attachments/{attachmentId}"]) {
  assert.ok((client + firestoreRules).includes(token), `Le flux collaboratif doit contenir ${token}.`);
}
assert.match(storageRules, /contentType == 'image\/jpeg'/);
assert.match(storageRules, /size <= 1024 \* 1024/);
console.log(JSON.stringify({ passed: true, mainPosts: 28, totalPosts: posts.length, movedPost: moved.id, contractChecks: 15 }, null, 2));
