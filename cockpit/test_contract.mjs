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

for (const token of ["getUserMedia", "SpeechRecognition", "webkitSpeechRecognition", "data-past-toggle", "cockpit-debug-launch", "Connexion…"]) {
  assert.ok(ui.includes(token), `Le cockpit doit contenir le contrat ${token}.`);
}
for (const token of ["addComment", "addCockpitFeedback", "memoryLocalCache", "withTimeout", "match /comments/{commentId}"]) {
  assert.ok((client + firestoreRules).includes(token), `Le flux collaboratif doit contenir ${token}.`);
}
assert.doesNotMatch(ui, /data-attachment-input|uploadImageAttachment|subscribeImageAttachments/);
assert.doesNotMatch(client, /firebase-storage|uploadBytes|getDownloadURL/);
console.log(JSON.stringify({ passed: true, mainPosts: 28, totalPosts: posts.length, movedPost: moved.id, contractChecks: 16 }, null, 2));
