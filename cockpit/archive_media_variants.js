import process from "node:process";
import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const eventId = argument("event-id");
const mediaIds = [...new Set(argument("media-ids").split(",").map((value) => value.trim()).filter(Boolean))];
const reason = argument("reason").trim().slice(0, 500);
const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm-archive");
const validId = (value, maximum = 180) => value.length <= maximum && /^[A-Za-z0-9_-]{3,180}$/.test(value);

if (!validId(eventId, 80) || !mediaIds.length || mediaIds.some((id) => !validId(id, 160))) throw new Error("Événement et identifiants média requis.");
if (!reason) throw new Error("Un motif éditorial explicite est requis.");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Compte de service local requis.");
if (apply && !confirm) throw new Error("Relancer avec --apply --confirm-archive après vérification du dry-run.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const admins = await db.collection("users").where("role", "==", "admin").where("active", "==", true).limit(2).get();
if (admins.size !== 1) throw new Error(`Un unique compte communications actif est requis (trouvé : ${admins.size}).`);
const actor = { uid: admins.docs[0].id, ...admins.docs[0].data() };
const actorLabel = String(actor.displayLabel || "Direction des communications").slice(0, 120);
const targets = mediaIds.map((id) => ({
  id,
  media: db.doc(`mediaLinks/${id}`),
  archive: db.doc(`changeArchive/${`archive-media-${id}-editorial-refocus`.slice(0, 160)}`)
}));
const initial = await Promise.all(targets.map(async (target) => ({
  ...target,
  mediaSnapshot: await target.media.get(),
  archiveSnapshot: await target.archive.get()
})));
const candidates = initial.filter(({ mediaSnapshot, archiveSnapshot }) => mediaSnapshot.exists && !archiveSnapshot.exists && !(mediaSnapshot.data().archived === true && mediaSnapshot.data().stage === "archived"));
for (const { id, mediaSnapshot } of initial) {
  if (mediaSnapshot.exists && mediaSnapshot.data().eventId !== eventId) throw new Error(`${id} n’appartient pas à ${eventId}.`);
}
console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  eventId,
  reason,
  requested: mediaIds,
  found: initial.filter((item) => item.mediaSnapshot.exists).map((item) => item.id),
  alreadyArchived: initial.filter((item) => item.archiveSnapshot.exists || (item.mediaSnapshot.exists && item.mediaSnapshot.data().archived === true && item.mediaSnapshot.data().stage === "archived")).map((item) => item.id),
  toArchive: candidates.map((item) => item.id)
}, null, 2));

if (apply && candidates.length) {
  await db.runTransaction(async (transaction) => {
    const current = await Promise.all(candidates.map(async (target) => ({
      ...target,
      mediaSnapshot: await transaction.get(target.media),
      archiveSnapshot: await transaction.get(target.archive)
    })));
    for (const item of current) {
      const before = candidates.find((candidate) => candidate.id === item.id);
      if (item.archiveSnapshot.exists) continue;
      if (!item.mediaSnapshot.exists || !before.mediaSnapshot.updateTime.isEqual(item.mediaSnapshot.updateTime)) throw new Error(`Le média ${item.id} a changé; relancer le dry-run.`);
      const previous = item.mediaSnapshot.data();
      const after = { stage: "archived", archived: true, publicationBlocked: true, selectedFinal: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid };
      transaction.update(item.media, after);
      transaction.set(item.archive, {
        entityType: "mediaLink",
        entityId: item.id,
        action: "ancienne proposition média archivée sans suppression",
        reason,
        before: previous,
        after: { ...previous, ...after },
        actorUid: actor.uid,
        actorLabel,
        createdAt: FieldValue.serverTimestamp()
      });
    }
  });
  console.log(`${candidates.length} proposition(s) archivée(s) sans suppression.`);
}

await deleteApp(app);
