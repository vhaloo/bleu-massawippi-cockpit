import process from "node:process";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS doit pointer vers un compte de service Firebase privé.");
}

const app = initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined
});
const db = getFirestore(app);

const media = [
  {
    id: "history-alt-20260719-1859",
    eventId: "alt-20260719",
    label: "Massawippi — estampe de 1859",
    url: "https://bleumassawippi.sharepoint.com/:i:/g/IQBUv6nNi_sFRKQ1YGzWtu_fAfx8KUSOP9ylkcSuQxmf3bQ",
    note: "Média source attribué à la capsule du 19 juillet. Domaine public — Samuel Bradshaw, d’après William Henry Bartlett; crédit complet dans le brief."
  },
  {
    id: "history-alt-20260726-steamship",
    eventId: "alt-20260726",
    label: "Bateau à vapeur sur le lac Massawippi — vers 1904",
    url: "https://bleumassawippi.sharepoint.com/:i:/g/IQAk0fsS-gmuS4svLKPck5zIAcHyspAcM8ONAEjl4recPUE",
    note: "Média source attribué à la capsule du 26 juillet. Domaine public — Société d’histoire de Sherbrooke, fonds Frederick James Sangster."
  },
  {
    id: "history-alt-20260801-aerial",
    eventId: "alt-20260801",
    label: "Vue aérienne de North Hatley — entre 1930 et 1950",
    url: "https://bleumassawippi.sharepoint.com/:i:/g/IQCdJrHJCN9eTbqQfxQRD9vWARO7jm94ZL11uMLA_leHEnw",
    note: "Média source attribué à la capsule du 1er août. Domaine public — Associated Screen News Limited, collection BAnQ."
  },
  {
    id: "history-alt-20260804-falls",
    eventId: "alt-20260804",
    label: "Chutes de Massawippi et moulin à scie — vers 1865",
    url: "https://bleumassawippi.sharepoint.com/:i:/g/IQAvxjhmyqmwTJfo2Sw9-ALWAabWAPbyXPY4HnFBxAi1OUs",
    note: "Média source attribué à la capsule du 4 août. Domaine public — Musée McCord Stewart, Archives photographiques Notman, cote MP-1982.157."
  },
  {
    id: "history-alt-20260807-ayers-cliff",
    eventId: "alt-20260807",
    label: "Ayer’s Cliff — carte postale, environ 1914–1940",
    url: "https://bleumassawippi.sharepoint.com/:i:/g/IQCv9M88-9ZsQJvYxadzMDT7AcvyrbjaX3ML-zmfZ2oo_4w",
    note: "Média source attribué à la capsule du 7 août. Domaine public — collection BAnQ 2637704."
  },
  {
    id: "history-alt-20260810-resort",
    eventId: "alt-20260810",
    label: "North Hatley, destination de villégiature — environ 1905–1940",
    url: "https://bleumassawippi.sharepoint.com/:i:/g/IQCX1oinct9xQorNjaBoYhRCAVOcRzEiwKOSgcis0OO5zK4",
    note: "Média source attribué à la capsule du 10 août. Domaine public — collection BAnQ 3730812."
  }
];

const batch = db.batch();
let created = 0;
let updated = 0;
for (const item of media) {
  const reference = db.collection("mediaLinks").doc(item.id);
  const existing = await reference.get();
  const payload = {
    eventId: item.eventId,
    label: item.label,
    url: item.url,
    kind: "image",
    stage: "source",
    note: item.note,
    archived: false,
    authorUid: "system-seed",
    authorLabel: "Banque historique documentée",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "system-seed"
  };
  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
    created += 1;
  } else {
    updated += 1;
  }
  batch.set(reference, payload, { merge: true });
}

await batch.commit();
console.log(JSON.stringify({ seeded: true, media: media.length, created, updated, eventIds: media.map((item) => item.eventId) }, null, 2));
