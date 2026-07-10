import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(workspaceDir, "..", "index.html");
const dryRun = process.argv.includes("--dry-run");
const source = await fs.readFile(sourcePath, "utf8");
const css = source.match(/<style>([\s\S]*?)<\/style>/i)?.[1];
const html = source.match(/<body>([\s\S]*?)<script>\s*var posts=/i)?.[1]?.trim();
const script = source.match(/<script>\s*(var posts=\[[\s\S]*?)<\/script>/i)?.[1];
const postsJson = script?.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/)?.[1];

if (!css || !html || !script || !postsJson) {
  throw new Error("La structure du plan source ne permet pas de préparer le contenu sécurisé.");
}

const posts = JSON.parse(postsJson);
if (!Array.isArray(posts) || posts.length !== 28) {
  throw new Error("Le plan source doit contenir exactement 28 publications.");
}

const privateContent = {
  schemaVersion: 1,
  css,
  html,
  script
};
const size = Buffer.byteLength(JSON.stringify(privateContent), "utf8");
if (size > 900000) throw new Error("Le contenu privé dépasse la limite de sécurité de 900 Ko.");

if (dryRun) {
  console.log(JSON.stringify({ sourcePath, posts: posts.length, privateContentBytes: size, ready: true }, null, 2));
  process.exit(0);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
}

const app = initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined
});
const db = getFirestore(app);
const batch = db.batch();
batch.set(db.collection("privateContent").doc("plan"), {
  ...privateContent,
  updatedAt: FieldValue.serverTimestamp()
});

let createdStates = 0;
for (const post of posts) {
  if (!/^[a-z0-9-]{3,80}$/i.test(post.id)) throw new Error("Identifiant de publication invalide : " + post.id);
  const ref = db.collection("scheduleItems").doc(post.id);
  const existing = await ref.get();
  if (!existing.exists) {
    batch.set(ref, {
      title: String(post.title).slice(0, 220),
      dateKey: String(post.date).slice(0, 80),
      status: "pending",
      deleted: false,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "system_seed"
    });
    createdStates += 1;
  }
}

await batch.commit();
console.log(JSON.stringify({ seeded: true, posts: posts.length, createdStates, privateContentBytes: size }, null, 2));
